"""
WebSocket handler for Gemini Live API.
Handles real-time voice conversation between visitors and the AI guide.
"""

import os
import asyncio
import base64
import hashlib
import json
import logging
import time
import re
import unicodedata
from typing import Optional
from importlib.metadata import version as pkg_version, PackageNotFoundError

from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from persona.prompt_builder import build_prompt
from live.rag_context import get_exhibit_context, get_exhibit_name, get_museum_prompt_config
from live.session_manager import SessionManager
from security.rate_limit import register_ws_session, unregister_ws_session


logger = logging.getLogger(__name__)
session_manager = SessionManager()
MAX_AUDIO_CHUNK_BYTES = int(os.getenv("WS_MAX_AUDIO_CHUNK_BYTES", str(64 * 1024)))
MAX_MESSAGE_SIZE = int(os.getenv("WS_MAX_MESSAGE_SIZE", str(256 * 1024)))
MAX_AUDIO_SECONDS_PER_MINUTE = int(os.getenv("WS_MAX_AUDIO_SECONDS_PER_MINUTE", "45"))
PCM_16KHZ_MONO_BYTES_PER_SEC = 16000 * 2
MAX_CONTINUOUS_AUDIO_SEC = int(os.getenv("WS_MAX_CONTINUOUS_AUDIO_SEC", "300"))

LANGUAGE_NAMES = {
    "vi": "Vietnamese",
    "en": "English",
    "de": "German",
    "ru": "Russian",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
}

LANGUAGE_COMMANDS = {
    "en": [
        "switch to english",
        "in english",
        "speak english",
        "answer in english",
        "continue in english",
        "explain in english",
        "tell me in english",
    ],
    "de": ["auf deutsch", "in german", "switch to german", "speak german"],
    "ru": ["по-русски", "in russian", "switch to russian", "speak russian"],
    "ar": ["بالعربية", "in arabic", "switch to arabic", "speak arabic"],
    "vi": [
        "tieng viet",
        "bang tieng viet",
        "tra loi tieng viet",
        "noi tieng viet",
        "chuyen sang tieng viet",
    ],
    "fr": ["en francais", "in french", "switch to french", "parle francais"],
    "ja": ["日本語で", "japanese please", "switch to japanese", "in japanese"],
    "ko": ["한국어로", "in korean", "switch to korean"],
    "zh": ["用中文", "in chinese", "switch to chinese", "说中文"],
    "es": ["en espanol", "in spanish", "switch to spanish", "habla espanol"],
}


def _normalize_for_command(text: str) -> str:
    lowered = (text or "").lower().strip()
    normalized = unicodedata.normalize("NFKD", lowered)
    no_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", no_accents)


def detect_language_command(transcript: str) -> str | None:
    text = _normalize_for_command(transcript)
    if len(text) < 5:
        return None
    for lang_code, patterns in LANGUAGE_COMMANDS.items():
        if any(pattern in text for pattern in patterns):
            return lang_code
    return None


class GeminiLiveHandler:
    """Handler for Gemini Live API websocket sessions."""

    def __init__(self, exhibit: dict, language: str = "vi", exhibit_id: str | None = None):
        self.exhibit = exhibit
        self.language = language
        self.system_instruction = build_prompt(exhibit, language)
        self.exhibit_id = exhibit_id
        self._exhibit_name = exhibit.get("name", "exhibit")
        self._museum_ai_persona = ""
        self._museum_welcome_messages: dict[str, str] = {}
        self._exhibit_system_prompt = str(exhibit.get("system_prompt", "") or "").strip()

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")

        self.client = genai.Client(api_key=api_key)
        self.session: Optional[genai.types.LiveSession] = None
        self.session_state = None
        self.last_audio_chunk_at_ms: int = 0
        self._last_assistant_transcript: str = ""
        self._closing = False
        self._closed = False
        self._close_reason = "normal"
        self._accepting_input = True
        self._tasks: list[asyncio.Task] = []
        self._ai_turn_active = False
        self._client_ip = "unknown"
        self._registered_ws_slot = False
        self._started_at = time.monotonic()
        self._audio_window_started_at = time.monotonic()
        self._audio_window_bytes = 0
        self._turn_started_at: float | None = None
        self._pending_language_reminder = False
        try:
            self._genai_version = pkg_version("google-genai")
        except PackageNotFoundError:
            self._genai_version = "unknown"

    async def handle_websocket(self, websocket: WebSocket):
        """Handle websocket connection from client."""
        await websocket.accept()
        exhibit_name = self.exhibit.get("name", "exhibit")
        logger.info("🔌 Client connected: %s | exhibit=%s", websocket.client, exhibit_name)
        logger.info("📦 google-genai version: %s", self._genai_version)
        self._client_ip = websocket.client.host if websocket.client else "unknown"

        try:
            await register_ws_session(self._client_ip)
            self._registered_ws_slot = True
            self.session_state = await session_manager.create_session(
                exhibit_id=str(self.exhibit.get("id", self.exhibit_id or "unknown")),
                language=self.language,
                client_ip=self._client_ip,
            )
            await session_manager.register_shutdown_hook(
                self.session_state.session_id,
                lambda why: self.close_session(websocket, reason=why),
            )
            exhibit_name = self._exhibit_name
            exhibit_context = ""
            if self.exhibit_id:
                try:
                    exhibit_context = await get_exhibit_context(self.exhibit_id, top_k=12)
                    if exhibit_context:
                        exhibit_name = await get_exhibit_name(self.exhibit_id)
                except Exception as rag_e:
                    logger.warning("Failed to load exhibit context: %s", rag_e)

            museum_id = str(self.exhibit.get("museum_id", "") or "")
            if museum_id:
                try:
                    museum_cfg = await get_museum_prompt_config(museum_id)
                    self._museum_ai_persona = str(museum_cfg.get("ai_persona", "") or "").strip()
                    self._museum_welcome_messages = museum_cfg.get("welcome_message", {}) or {}
                except Exception as museum_e:
                    logger.warning("Failed to load museum prompt config: %s", museum_e)

            system_prompt, prompt_meta = self._compose_system_prompt(
                exhibit_name=exhibit_name,
                exhibit_context=exhibit_context,
            )
            prompt_hash = hashlib.sha256(system_prompt.encode("utf-8")).hexdigest()[:12]
            logger.info(
                "🧠 prompt meta: has_museum_persona=%s has_exhibit_override=%s "
                "has_fallback=%s context_chars=%d prompt_chars=%d hash=%s",
                prompt_meta["has_museum_persona"],
                prompt_meta["has_exhibit_override"],
                prompt_meta["has_fallback"],
                prompt_meta["context_chars"],
                len(system_prompt),
                prompt_hash,
            )

            system_instruction_content = types.Content(parts=[types.Part(text=system_prompt)])

            voice_name     = os.getenv("VOICE_NAME", "Kore")
            model_name     = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
            temperature    = float(os.getenv("VOICE_TEMPERATURE", "0.55"))
            max_tokens     = int(os.getenv("VOICE_MAX_OUTPUT_TOKENS", "1400"))

            config = {
                "response_modalities": ["AUDIO"],
                "speech_config": {
                    "voice_config": {"prebuilt_voice_config": {"voice_name": voice_name}}
                },
                "generation_config": {
                    "thinking_config": {"include_thoughts": False, "thinking_budget": 0},
                    "temperature": temperature,
                    "candidate_count": 1,
                    "max_output_tokens": max_tokens,
                },
                "system_instruction": system_instruction_content,
                # Manual turn mode: client sends end_of_turn to trigger generation.
                "realtime_input_config": {
                    "automatic_activity_detection": {"disabled": True}
                },
            }

            # SDK currently installed may not expose this field yet.
            # Sending an unsupported field causes 1007 invalid frame payload at connect-time.
            if "output_audio_transcription" in types.LiveConnectConfig.model_fields:
                config["output_audio_transcription"] = {}
                logger.info("✅ output_audio_transcription enabled in Live config")
            else:
                logger.warning(
                    "⚠️ SDK does not support output_audio_transcription field; "
                    "upgrade google-genai to enable official transcript stream"
                )

            logger.info("✅ Live config: model=%s, voice=%s", model_name, voice_name)

            async with self.client.aio.live.connect(model=model_name, config=config) as session:
                self.session = session
                logger.info("🤖 Gemini session created")

                # Notify frontend: ready for interaction.
                await websocket.send_json({"type": "ready", "message": "Connected to Gemini Live"})

                # Run receive/send loops concurrently.
                receive_task = asyncio.create_task(
                    self._receive_from_client(websocket, session)
                )
                send_task = asyncio.create_task(
                    self._send_to_client(websocket, session)
                )
                watchdog_task = asyncio.create_task(
                    self._watchdog_loop(websocket, session)
                )
                heartbeat_task = asyncio.create_task(
                    self._heartbeat_loop(websocket)
                )
                self._tasks = [receive_task, send_task, watchdog_task, heartbeat_task]

                try:
                    done, pending = await asyncio.wait(
                        self._tasks,
                        return_when=asyncio.FIRST_EXCEPTION,
                    )
                    for task in done:
                        if task.exception():
                            logger.error("Task raised: %s", task.exception())
                            self._close_reason = "internal_error"
                    if not self._closing:
                        if self._close_reason != "internal_error":
                            self._close_reason = "normal"
                except Exception as e:
                    logger.error("gather error: %s", e)
                    self._close_reason = "internal_error"

                await self.close_session(websocket, reason=self._close_reason)
                logger.info("WebSocket session ended: reason=%s", self._close_reason)

        except WebSocketDisconnect:
            logger.info("Client disconnected")
            await self.close_session(websocket, reason="client_disconnect")
        except Exception as e:
            logger.error(f"Error in WebSocket handler: {e}", exc_info=True)
            try:
                await websocket.send_json({"type": "error", "message": "Internal server error"})
            except Exception:
                pass
            await self.close_session(websocket, reason="internal_error")
        finally:
            await self.close_session(websocket, reason=self._close_reason or "normal")

    async def close_session(self, websocket: WebSocket, reason: str):
        """
        Graceful shutdown sequence for one websocket session.
        """
        if self._closed:
            return
        self._closing = True
        self._close_reason = reason
        self._accepting_input = False

        ws_code = self._reason_to_ws_code(reason)
        session_id = self.session_state.session_id if self.session_state else "unknown"

        # 1-2. Notify client session is ending.
        try:
            await websocket.send_json({"type": "session_end", "reason": reason, "code": ws_code})
        except Exception:
            pass

        # 3. Best-effort flush: avoid cutting a sentence mid-turn.
        flush_deadline = time.monotonic() + 3.0
        while self._ai_turn_active and time.monotonic() < flush_deadline:
            await asyncio.sleep(0.05)

        # 4. Cancel background tasks.
        current = asyncio.current_task()
        for task in self._tasks:
            if task is current:
                continue
            if not task.done():
                task.cancel()
        for task in self._tasks:
            if task is current:
                continue
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
        self._tasks = []

        # 5. Close Gemini live stream.
        try:
            if self.session is not None:
                await self.session.aclose()
        except Exception:
            pass
        self.session = None

        # 6. Decrement ws_active counter.
        if self._registered_ws_slot:
            try:
                await unregister_ws_session(self._client_ip)
            except Exception:
                logger.warning("Failed to unregister ws slot for ip=%s", self._client_ip)
            self._registered_ws_slot = False

        # 7. Session stats log.
        summary = None
        if self.session_state:
            try:
                await session_manager.unregister_shutdown_hook(self.session_state.session_id)
            except Exception:
                pass
            try:
                summary = await session_manager.finish_session(self.session_state.session_id, reason=reason)
            except Exception:
                logger.warning("Failed to finish session in manager: %s", session_id)
            self.session_state = None
        if summary:
            logger.info("📊 session_summary: %s", summary)
        else:
            logger.info(
                "📊 session_summary: {'session_id': '%s', 'reason': '%s', 'duration_sec': %.3f}",
                session_id,
                reason,
                max(0.0, time.monotonic() - self._started_at),
            )

        # 8. Close websocket with mapped code.
        try:
            await websocket.close(code=ws_code, reason=reason)
        except Exception:
            pass
        self._closed = True

    async def _receive_from_client(self, websocket: WebSocket, session):
        """Receive audio/text from client and forward to Gemini."""
        try:
            while True:
                raw = await websocket.receive_text()
                if len(raw.encode("utf-8")) > MAX_MESSAGE_SIZE:
                    self._close_reason = "policy_violation"
                    await self.close_session(websocket, reason="policy_violation")
                    break
                message = json.loads(raw)
                msg_type = message.get("type")
                if self._closing:
                    break
                if self.session_state:
                    await session_manager.touch_client_activity(self.session_state.session_id)
                    await session_manager.incr_in(self.session_state.session_id)

                if msg_type == "audio":
                    if not self._accepting_input:
                        continue
                    audio_b64 = message.get("data", "")
                    if audio_b64:
                        audio_bytes = base64.b64decode(audio_b64)
                        if len(audio_bytes) > MAX_AUDIO_CHUNK_BYTES:
                            logger.warning("Audio chunk too large: %d bytes", len(audio_bytes))
                            self._close_reason = "policy_violation"
                            await self.close_session(websocket, reason="policy_violation")
                            break
                        now = time.monotonic()
                        if (now - self._audio_window_started_at) > 60:
                            self._audio_window_started_at = now
                            self._audio_window_bytes = 0
                        self._audio_window_bytes += len(audio_bytes)
                        audio_seconds_minute = self._audio_window_bytes / PCM_16KHZ_MONO_BYTES_PER_SEC
                        if audio_seconds_minute > MAX_AUDIO_SECONDS_PER_MINUTE:
                            logger.warning("Audio flood detected: %.2fs in current minute", audio_seconds_minute)
                            self._close_reason = "policy_violation"
                            await self.close_session(websocket, reason="policy_violation")
                            break
                        if self.session_state:
                            await session_manager.incr_in(
                                self.session_state.session_id, audio_bytes=len(audio_bytes)
                            )
                        self.last_audio_chunk_at_ms = int(time.monotonic() * 1000)
                        await session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                        )
                        logger.debug("🎙️ Forwarded audio chunk (%d bytes) to Gemini", len(audio_bytes))

                elif msg_type == "start_of_turn":
                    if not self._accepting_input:
                        continue
                    self._turn_started_at = time.monotonic()
                    # Manual turn mode with realtime input boundaries.
                    await session.send_realtime_input(activity_start=types.ActivityStart())
                    logger.info("📥 start_of_turn from client → activity_start sent")

                elif msg_type == "end_of_turn":
                    if not self._accepting_input:
                        continue
                    self._turn_started_at = None
                    # Manual turn mode: close current activity so Gemini can respond
                    # to the audio just streamed. Avoid sending dummy text payloads.
                    now_ms = int(time.monotonic() * 1000)
                    since_last_audio = (
                        now_ms - self.last_audio_chunk_at_ms if self.last_audio_chunk_at_ms else -1
                    )
                    logger.info(
                        "📥 end_of_turn from client → signaling Gemini (last_audio=%dms)",
                        since_last_audio,
                    )
                    await self._inject_language_reminder(session)
                    await session.send_realtime_input(activity_end=types.ActivityEnd())
                    logger.info("✅ end_of_turn sent (activity_end)")

                elif msg_type == "request_greeting":
                    if not self._accepting_input:
                        continue
                    # Keep greeting trigger short; persona/style already lives in system prompt.
                    lang_name = self._language_label(self.language)
                    welcome_by_lang = self._museum_welcome_messages or {}
                    welcome_line = str(welcome_by_lang.get(self.language, "")).strip()
                    if not welcome_line:
                        welcome_line = str(welcome_by_lang.get("en", "")).strip()

                    welcome_instruction = (
                        f'If appropriate, start with this welcome line: "{welcome_line}". '
                        if welcome_line
                        else ""
                    )
                    greeting = (
                        f"Introduce the exhibit \"{self._exhibit_name}\" in 2-3 concise sentences "
                        f"in {lang_name}. {welcome_instruction}"
                    )
                    await session.send(input=greeting, end_of_turn=True)
                    logger.info("📤 Sent to Gemini: %s", greeting[:80])

                elif msg_type == "interrupt":
                    # Client stopped local playback; no message is sent to Gemini.
                    # Gemini completes the current turn naturally.
                    logger.info("📥 interrupt from client — client stopped audio, waiting for next turn")

                elif msg_type == "text":
                    if not self._accepting_input:
                        continue
                    # Fallback text input
                    text = message.get("data", "")
                    if text:
                        await session.send(input=text, end_of_turn=True)
                        logger.info("📤 Sent to Gemini: %s", text[:80])

                elif msg_type == "set_language":
                    requested = str(message.get("language", "")).strip().lower()
                    switched = await self._switch_language(websocket, requested, source="manual_ui")
                    if switched:
                        await websocket.send_json(
                            {
                                "type": "language_switch_ack",
                                "language": self.language,
                            }
                        )
                        if self.session_state:
                            await session_manager.incr_out(self.session_state.session_id)

                elif msg_type == "pong":
                    if self.session_state:
                        await session_manager.touch_pong(self.session_state.session_id)
                    continue

                else:
                    logger.warning("Unknown msg type: %s", msg_type)

                if self._turn_started_at and (time.monotonic() - self._turn_started_at) > MAX_CONTINUOUS_AUDIO_SEC:
                    logger.warning("Continuous client stream over %ss without end_of_turn", MAX_CONTINUOUS_AUDIO_SEC)
                    self._close_reason = "policy_violation"
                    await self.close_session(websocket, reason="policy_violation")
                    break

        except WebSocketDisconnect:
            logger.info("Client disconnected in receive loop")
            raise
        except Exception as e:
            logger.error("Error in receive loop: %s", e, exc_info=True)
            raise

    async def _send_to_client(self, websocket: WebSocket, session):
        """
        Receive responses from Gemini and stream back to client.

        IMPORTANT: keep a while loop so receiving continues after each turn_complete,
        since session.receive() may exit per turn.
        """
        try:
            current_turn_text = ""
            recovery_attempted = False
            turn_audio_chunks = 0
            turn_transcript_chunks = 0
            while True:
                if self._closing:
                    break
                got_any = False
                async for response in session.receive():
                    if self._closing:
                        break
                    got_any = True
                    self._ai_turn_active = True
                    try:
                        self._log_response(response)
                        logger.info(
                            "RAW response flags: data=%s text=%s server_content=%s",
                            bool(response.data),
                            bool(response.text),
                            bool(response.server_content),
                        )

                        # Audio chunk
                        if response.data:
                            audio_b64 = base64.b64encode(response.data).decode("utf-8")
                            await websocket.send_json({"type": "audio_chunk", "audio": audio_b64})
                            if self.session_state:
                                await session_manager.incr_out(
                                    self.session_state.session_id, audio_bytes=len(response.data)
                                )
                            logger.info("🔊 Audio chunk: %d bytes", len(response.data))
                            turn_audio_chunks += 1

                        if response.server_content:
                            sc = response.server_content
                            logger.info("server_content: %s", sc)
                            sent_transcript = False

                            # Official transcript source for native audio models.
                            output_tx = getattr(sc, "output_transcription", None)
                            if output_tx and getattr(output_tx, "text", None):
                                text = str(output_tx.text).strip()
                                if text:
                                    sent = await self._send_assistant_transcript(websocket, text)
                                    if sent:
                                        current_turn_text = f"{current_turn_text} {sent}".strip()
                                        turn_transcript_chunks += 1
                                    logger.info("📝 Transcript(output_transcription): %s", text[:80])
                                    sent_transcript = True
                            else:
                                logger.info("ℹ️ No output_transcription in this response chunk")

                            # SDK/model fallback: some versions expose assistant text at response.text.
                            if not sent_transcript and response.text and response.text.strip():
                                sent = await self._send_assistant_transcript(websocket, response.text.strip())
                                if sent:
                                    current_turn_text = f"{current_turn_text} {sent}".strip()
                                    turn_transcript_chunks += 1
                                logger.info("📝 Transcript(fallback response.text): %s", response.text[:80])

                            # Interrupted
                            if getattr(sc, "interrupted", False):
                                    await websocket.send_json({"type": "interrupted"})
                                    if self.session_state:
                                        await session_manager.incr_out(self.session_state.session_id)
                                    logger.info("⚠️ Gemini interrupted")

                            # Input transcription (user speech transcript, if available)
                            if getattr(sc, "input_transcription", None):
                                txt = sc.input_transcription.text
                                logger.info("🎤 Input transcript: %s", str(txt)[:80])
                                await websocket.send_json({"type": "user_transcript", "text": txt})
                                if self.session_state:
                                    await session_manager.incr_out(self.session_state.session_id)
                                requested_lang = detect_language_command(str(txt or ""))
                                if requested_lang:
                                    await self._switch_language(
                                        websocket,
                                        requested_lang,
                                        source="voice_command",
                                    )

                            # Turn complete
                            if getattr(sc, "turn_complete", False):
                                truncated = self._looks_truncated(current_turn_text)
                                logger.info(
                                    "🧭 turn_complete diagnostics: audio_chunks=%d, transcript_chunks=%d, "
                                    "transcript_chars=%d, truncated=%s, recovery_attempted=%s",
                                    turn_audio_chunks,
                                    turn_transcript_chunks,
                                    len(current_turn_text),
                                    truncated,
                                    recovery_attempted,
                                )
                                logger.info("🧭 turn_complete transcript_tail: %s", current_turn_text[-160:] if current_turn_text else "(empty)")
                                logger.info("🧭 turn_complete server_content snapshot: %s", sc)

                                if (not recovery_attempted) and truncated:
                                    recovery_attempted = True
                                    logger.warning(
                                        "⚠️ Detected truncated ending, requesting continuation: %s",
                                        current_turn_text[-120:],
                                    )
                                    await session.send(
                                        input=(
                                            "You were cut off mid-sentence. Continue from where you stopped "
                                            "and complete the previous idea in 1-2 short sentences. "
                                            "Do not restart from the beginning."
                                        ),
                                        end_of_turn=True,
                                    )
                                    continue

                                await websocket.send_json({"type": "turn_complete"})
                                if self.session_state:
                                    await session_manager.incr_out(self.session_state.session_id)
                                logger.info("✅ turn_complete sent to client")
                                self._last_assistant_transcript = ""
                                current_turn_text = ""
                                recovery_attempted = False
                                turn_audio_chunks = 0
                                turn_transcript_chunks = 0
                                self._ai_turn_active = False

                    except WebSocketDisconnect:
                        raise
                    except Exception as inner_e:
                        logger.error("Error processing Gemini response: %s", inner_e, exc_info=True)
                        # Do not raise here; continue processing subsequent responses.

                if not got_any:
                    # session.receive() returned without responses; back off briefly.
                    await asyncio.sleep(0.1)
                else:
                    self._ai_turn_active = False

        except WebSocketDisconnect:
            logger.info("Client disconnected in send loop")
            raise
        except Exception as e:
            logger.error("Fatal error in send loop: %s", e, exc_info=True)
            raise

    def _log_response(self, response):
        """Log a compact summary of Gemini responses."""
        data_bytes = len(response.data) if response.data else 0
        text_preview = response.text[:30] if response.text else None
        turn_complete = False
        if response.server_content:
            turn_complete = getattr(response.server_content, "turn_complete", False)
        logger.info(
            "📤 Gemini → data=%d bytes, text=%s, turn_complete=%s",
            data_bytes, text_preview, turn_complete
        )

    async def _send_assistant_transcript(self, websocket: WebSocket, text: str) -> str:
        """Send assistant transcript with basic dedupe for incremental repeats."""
        normalized = " ".join(text.split()).strip()
        if not normalized:
            return ""

        if normalized == self._last_assistant_transcript:
            return ""

        # If model sends cumulative text, send only the delta to client.
        if (
            self._last_assistant_transcript
            and normalized.startswith(self._last_assistant_transcript)
        ):
            delta = normalized[len(self._last_assistant_transcript):].strip()
            if not delta:
                return ""
            payload_text = delta
        # If an older/shorter partial arrives late, skip it.
        elif (
            self._last_assistant_transcript
            and self._last_assistant_transcript.startswith(normalized)
        ):
            return ""
        else:
            payload_text = normalized

        await websocket.send_json({
            "type": "transcript",
            "role": "assistant",
            "text": payload_text,
        })
        if self.session_state:
            await session_manager.incr_out(self.session_state.session_id)
        logger.info("📝 Transcript: %s", payload_text[:80])
        self._last_assistant_transcript = normalized
        return payload_text

    async def _heartbeat_loop(self, websocket: WebSocket):
        """
        Layer 3: heartbeat ping/pong to detect zombie connections.
        """
        interval_sec = int(os.getenv("WS_HEARTBEAT_INTERVAL_SEC", "30"))
        pong_timeout_sec = int(os.getenv("WS_PONG_TIMEOUT_SEC", "10"))
        while not self._closing:
            await asyncio.sleep(interval_sec)
            if self._closing:
                break
            try:
                await websocket.send_json({"type": "ping", "ts": int(time.time() * 1000)})
                if self.session_state:
                    await session_manager.incr_out(self.session_state.session_id)
            except Exception:
                self._close_reason = "network_drop"
                break

            # Wait for pong freshness.
            await asyncio.sleep(pong_timeout_sec)
            if self.session_state:
                state = await session_manager.get_session(self.session_state.session_id)
                if state and (time.monotonic() - state.last_pong_at) > (interval_sec + pong_timeout_sec):
                    self._close_reason = "heartbeat_timeout"
                    await self.close_session(websocket, reason="heartbeat_timeout")
                    break

    async def _watchdog_loop(self, websocket: WebSocket, session):
        """
        Layered timeout protections:
        1) inactivity, 2) max session duration, 4) hard absolute limit.
        """
        del session  # reserved for future adaptive checks

        inactivity_sec = int(os.getenv("WS_INACTIVITY_TIMEOUT_SEC", "180"))
        inactivity_grace_sec = int(os.getenv("WS_INACTIVITY_GRACE_SEC", "30"))
        max_duration_sec = int(os.getenv("WS_MAX_SESSION_SEC", "900"))
        max_duration_grace_sec = int(os.getenv("WS_MAX_SESSION_GRACE_SEC", "30"))
        hard_limit_sec = int(os.getenv("WS_HARD_LIMIT_SEC", "1200"))

        inactivity_warned = False
        duration_warned = False

        while not self._closing:
            await asyncio.sleep(1.0)
            if self._closing or not self.session_state:
                break

            state = await session_manager.get_session(self.session_state.session_id)
            if not state:
                break

            now = time.monotonic()
            idle = now - state.last_client_activity_at
            age = now - state.started_at

            # Layer 4: hard absolute limit.
            if age >= hard_limit_sec:
                await self.close_session(websocket, reason="hard_limit")
                break

            # Layer 1: inactivity warning then close.
            if not inactivity_warned and idle >= inactivity_sec:
                inactivity_warned = True
                try:
                    await websocket.send_json({
                        "type": "session_warning",
                        "reason": "inactivity",
                        "seconds_left": inactivity_grace_sec,
                    })
                    await session_manager.incr_out(self.session_state.session_id)
                except Exception:
                    pass
            if inactivity_warned and idle >= (inactivity_sec + inactivity_grace_sec):
                await self.close_session(websocket, reason="inactivity")
                break

            # Layer 2: max duration warning then close.
            if not duration_warned and age >= max_duration_sec:
                duration_warned = True
                try:
                    await websocket.send_json({
                        "type": "session_warning",
                        "reason": "max_duration",
                        "seconds_left": max_duration_grace_sec,
                    })
                    await session_manager.incr_out(self.session_state.session_id)
                except Exception:
                    pass
            if duration_warned and age >= (max_duration_sec + max_duration_grace_sec):
                await self.close_session(websocket, reason="max_duration")
                break

    def _looks_truncated(self, text: str) -> bool:
        """Heuristic check for likely cut-off endings."""
        if not text:
            return False

        trimmed = text.strip()
        if not trimmed:
            return False

        # Odd number of quotes usually means unfinished quote.
        if trimmed.count('"') % 2 == 1:
            return True

        # Missing terminal punctuation on a long sentence may indicate cut-off.
        if len(trimmed) >= 40 and not re.search(r"[.!?…\"”']\s*$", trimmed):
            return True

        last_word = trimmed.split()[-1] if trimmed.split() else ""
        if len(last_word) <= 2:
            return True

        dangling_words = {"that", "and", "but", "or", "because", "if", "when", "while", "to"}
        return last_word.lower() in dangling_words

    def _language_label(self, language: str) -> str:
        return LANGUAGE_NAMES.get(language, "English")

    async def _switch_language(
        self,
        websocket: WebSocket,
        to_language: str,
        source: str,
    ) -> bool:
        target = str(to_language or "").strip().lower()
        if target not in LANGUAGE_NAMES:
            return False
        if target == self.language:
            return False

        previous = self.language
        self.language = target
        self._pending_language_reminder = True
        logger.info("🌐 Language switched: %s -> %s (source=%s)", previous, target, source)

        try:
            await websocket.send_json(
                {
                    "type": "language_switched",
                    "from": previous,
                    "to": target,
                    "source": source,
                }
            )
            if self.session_state:
                await session_manager.incr_out(self.session_state.session_id)
        except Exception:
            logger.warning("Failed to emit language_switched event")
        return True

    async def _inject_language_reminder(self, session) -> None:
        if not self._pending_language_reminder:
            return
        lang_name = self._language_label(self.language)
        reminder = (
            "[System instruction update: "
            f"From now on, respond in {lang_name} for all following answers "
            "until the visitor asks to switch again. Keep the same persona and factual constraints.]"
        )
        try:
            await session.send(input=reminder, end_of_turn=False)
            logger.info("✅ Injected language reminder: %s", lang_name)
        except Exception as e:
            logger.warning("Failed to inject language reminder: %s", e)
        finally:
            self._pending_language_reminder = False

    def _reason_to_ws_code(self, reason: str) -> int:
        return {
            "normal": 1000,
            "client_disconnect": 1001,
            "inactivity": 4001,
            "max_duration": 4002,
            "rate_limit": 4003,
            "hard_limit": 4010,
            "heartbeat_timeout": 4011,
            "network_drop": 1001,
            "policy_violation": 1008,
            "internal_error": 1011,
        }.get(reason, 1000)

    def _compose_system_prompt(self, exhibit_name: str, exhibit_context: str) -> tuple[str, dict[str, object]]:
        """
        Build one orchestrated system prompt with clear precedence:
        exhibit override > museum persona > fallback template.
        """
        has_museum_persona = bool(self._museum_ai_persona.strip())
        has_exhibit_override = bool(self._exhibit_system_prompt.strip())
        fallback_template = self.system_instruction.strip()
        has_fallback = bool(fallback_template)
        context_text = exhibit_context.strip() or "No curated exhibit facts are available."
        language_label = self._language_label(self.language)

        museum_persona = (
            self._museum_ai_persona.strip()
            if has_museum_persona
            else "Friendly, clear, and educational museum guide."
        )
        exhibit_override = (
            self._exhibit_system_prompt.strip()
            if has_exhibit_override
            else "(none)"
        )

        prompt_with_fallback = f"""You are a professional museum guide currently presenting: {exhibit_name}.

LANGUAGE
- Current default response language is {language_label}.
- If the visitor asks to switch language (for example: "switch to English", "trả lời bằng tiếng Việt"),
  comply immediately and continue in the new language.
- Keep using the new language for subsequent answers until the visitor asks to switch again.

STYLE POLICY (tone and delivery)
- Museum persona baseline: {museum_persona}
- Exhibit-level override (highest priority): {exhibit_override}
- Fallback style template (use only when the two lines above are insufficient):
{fallback_template if has_fallback else "(none)"}

CONTENT POLICY (facts and grounding)
- Primary source of truth is the curated exhibit facts below.
- Do not invent names, dates, numbers, or events.
- If the requested detail is missing from the curated facts, say:
  "The museum currently has no verified information about that detail."

CURATED EXHIBIT FACTS
{context_text}

PRIORITY ORDER
1) Exhibit-level override
2) Museum persona baseline
3) Fallback style template
4) General safe conversational behavior
"""

        # Guard against oversized instructions. Drop fallback section first.
        max_chars = int(os.getenv("VOICE_SYSTEM_PROMPT_MAX_CHARS", "12000"))
        if len(prompt_with_fallback) <= max_chars:
            return prompt_with_fallback, {
                "has_museum_persona": has_museum_persona,
                "has_exhibit_override": has_exhibit_override,
                "has_fallback": has_fallback,
                "context_chars": len(context_text),
            }

        prompt_without_fallback = f"""You are a professional museum guide currently presenting: {exhibit_name}.

LANGUAGE
- Current default response language is {language_label}.
- If the visitor asks to switch language (for example: "switch to English", "trả lời bằng tiếng Việt"),
  comply immediately and continue in the new language.
- Keep using the new language for subsequent answers until the visitor asks to switch again.

STYLE POLICY (tone and delivery)
- Museum persona baseline: {museum_persona}
- Exhibit-level override (highest priority): {exhibit_override}

CONTENT POLICY (facts and grounding)
- Primary source of truth is the curated exhibit facts below.
- Do not invent names, dates, numbers, or events.
- If the requested detail is missing from the curated facts, say:
  "The museum currently has no verified information about that detail."

CURATED EXHIBIT FACTS
{context_text}

PRIORITY ORDER
1) Exhibit-level override
2) Museum persona baseline
3) General safe conversational behavior
"""
        logger.warning(
            "⚠️ System prompt exceeded max chars (%d). Fallback style template was removed.",
            max_chars,
        )
        return prompt_without_fallback, {
            "has_museum_persona": has_museum_persona,
            "has_exhibit_override": has_exhibit_override,
            "has_fallback": False,
            "context_chars": len(context_text),
        }


async def handle_persona_websocket(websocket: WebSocket, exhibit: dict, language: str = "vi"):
    """Entry point for websocket endpoint."""
    handler = GeminiLiveHandler(exhibit, language, exhibit.get("id"))
    await handler.handle_websocket(websocket)
