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
from typing import Optional
from importlib.metadata import version as pkg_version, PackageNotFoundError

from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from persona.prompt_builder import build_prompt
from live.rag_context import get_artifact_context, get_artifact_name, get_museum_prompt_config


logger = logging.getLogger(__name__)


class GeminiLiveHandler:
    """Handler for Gemini Live API websocket sessions."""

    def __init__(self, artifact: dict, language: str = "vi", artifact_id: str | None = None):
        self.artifact = artifact
        self.language = language
        self.system_instruction = build_prompt(artifact, language)
        self.artifact_id = artifact_id
        self._artifact_name = artifact.get("name", "artifact")
        self._museum_ai_persona = ""
        self._museum_welcome_messages: dict[str, str] = {}
        self._artifact_system_prompt = str(artifact.get("system_prompt", "") or "").strip()

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")

        self.client = genai.Client(api_key=api_key)
        self.session: Optional[genai.types.LiveSession] = None
        self.last_audio_chunk_at_ms: int = 0
        self._last_assistant_transcript: str = ""
        try:
            self._genai_version = pkg_version("google-genai")
        except PackageNotFoundError:
            self._genai_version = "unknown"

    async def handle_websocket(self, websocket: WebSocket):
        """Handle websocket connection from client."""
        await websocket.accept()
        artifact_name = self.artifact.get("name", "artifact")
        logger.info("🔌 Client connected: %s | artifact=%s", websocket.client, artifact_name)
        logger.info("📦 google-genai version: %s", self._genai_version)

        try:
            artifact_name = self._artifact_name
            artifact_context = ""
            if self.artifact_id:
                try:
                    artifact_context = await get_artifact_context(self.artifact_id, top_k=12)
                    if artifact_context:
                        artifact_name = await get_artifact_name(self.artifact_id)
                except Exception as rag_e:
                    logger.warning("Failed to load artifact context: %s", rag_e)

            museum_id = str(self.artifact.get("museum_id", "") or "")
            if museum_id:
                try:
                    museum_cfg = await get_museum_prompt_config(museum_id)
                    self._museum_ai_persona = str(museum_cfg.get("ai_persona", "") or "").strip()
                    self._museum_welcome_messages = museum_cfg.get("welcome_message", {}) or {}
                except Exception as museum_e:
                    logger.warning("Failed to load museum prompt config: %s", museum_e)

            system_prompt, prompt_meta = self._compose_system_prompt(
                artifact_name=artifact_name,
                artifact_context=artifact_context,
            )
            prompt_hash = hashlib.sha256(system_prompt.encode("utf-8")).hexdigest()[:12]
            logger.info(
                "🧠 prompt meta: has_museum_persona=%s has_artifact_override=%s "
                "has_fallback=%s context_chars=%d prompt_chars=%d hash=%s",
                prompt_meta["has_museum_persona"],
                prompt_meta["has_artifact_override"],
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

                try:
                    done, pending = await asyncio.wait(
                        [receive_task, send_task],
                        return_when=asyncio.FIRST_EXCEPTION,
                    )
                    for task in pending:
                        task.cancel()
                    for task in done:
                        if task.exception():
                            logger.error("Task raised: %s", task.exception())
                except Exception as e:
                    logger.error("gather error: %s", e)
                    receive_task.cancel()
                    send_task.cancel()

                logger.info("WebSocket session ended")

        except WebSocketDisconnect:
            logger.info("Client disconnected")
        except Exception as e:
            logger.error(f"Error in WebSocket handler: {e}", exc_info=True)
            try:
                await websocket.send_json({"type": "error", "message": "Internal server error"})
            except Exception:
                pass
        finally:
            try:
                await websocket.close()
            except Exception:
                pass

    async def _receive_from_client(self, websocket: WebSocket, session):
        """Receive audio/text from client and forward to Gemini."""
        try:
            while True:
                raw = await websocket.receive_text()
                message = json.loads(raw)
                msg_type = message.get("type")

                if msg_type == "audio":
                    audio_b64 = message.get("data", "")
                    if audio_b64:
                        audio_bytes = base64.b64decode(audio_b64)
                        self.last_audio_chunk_at_ms = int(time.monotonic() * 1000)
                        await session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                        )
                        logger.debug("🎙️ Forwarded audio chunk (%d bytes) to Gemini", len(audio_bytes))

                elif msg_type == "start_of_turn":
                    # Manual turn mode with realtime input boundaries.
                    await session.send_realtime_input(activity_start=types.ActivityStart())
                    logger.info("📥 start_of_turn from client → activity_start sent")

                elif msg_type == "end_of_turn":
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
                    await session.send_realtime_input(activity_end=types.ActivityEnd())
                    logger.info("✅ end_of_turn sent (activity_end)")

                elif msg_type == "request_greeting":
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
                        f"Introduce the artifact \"{self._artifact_name}\" in 2-3 concise sentences "
                        f"in {lang_name}. {welcome_instruction}"
                    )
                    await session.send(input=greeting, end_of_turn=True)
                    logger.info("📤 Sent to Gemini: %s", greeting[:80])

                elif msg_type == "interrupt":
                    # Client stopped local playback; no message is sent to Gemini.
                    # Gemini completes the current turn naturally.
                    logger.info("📥 interrupt from client — client stopped audio, waiting for next turn")

                elif msg_type == "text":
                    # Fallback text input
                    text = message.get("data", "")
                    if text:
                        await session.send(input=text, end_of_turn=True)
                        logger.info("📤 Sent to Gemini: %s", text[:80])

                else:
                    logger.warning("Unknown msg type: %s", msg_type)

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
                got_any = False
                async for response in session.receive():
                    got_any = True
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
                                logger.info("⚠️ Gemini interrupted")

                            # Input transcription (user speech transcript, if available)
                            if getattr(sc, "input_transcription", None):
                                txt = sc.input_transcription.text
                                logger.info("🎤 Input transcript: %s", str(txt)[:80])
                                await websocket.send_json({"type": "user_transcript", "text": txt})

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
                                logger.info("✅ turn_complete sent to client")
                                self._last_assistant_transcript = ""
                                current_turn_text = ""
                                recovery_attempted = False
                                turn_audio_chunks = 0
                                turn_transcript_chunks = 0

                    except WebSocketDisconnect:
                        raise
                    except Exception as inner_e:
                        logger.error("Error processing Gemini response: %s", inner_e, exc_info=True)
                        # Do not raise here; continue processing subsequent responses.

                if not got_any:
                    # session.receive() returned without responses; back off briefly.
                    await asyncio.sleep(0.1)

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
        logger.info("📝 Transcript: %s", payload_text[:80])
        self._last_assistant_transcript = normalized
        return payload_text

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
        return {
            "vi": "Vietnamese",
            "en": "English",
            "fr": "French",
            "ja": "Japanese",
            "ko": "Korean",
            "zh": "Chinese",
        }.get(language, "English")

    def _compose_system_prompt(self, artifact_name: str, artifact_context: str) -> tuple[str, dict[str, object]]:
        """
        Build one orchestrated system prompt with clear precedence:
        artifact override > museum persona > fallback template.
        """
        has_museum_persona = bool(self._museum_ai_persona.strip())
        has_artifact_override = bool(self._artifact_system_prompt.strip())
        fallback_template = self.system_instruction.strip()
        has_fallback = bool(fallback_template)
        context_text = artifact_context.strip() or "No curated artifact facts are available."
        language_label = self._language_label(self.language)

        museum_persona = (
            self._museum_ai_persona.strip()
            if has_museum_persona
            else "Friendly, clear, and educational museum guide."
        )
        artifact_override = (
            self._artifact_system_prompt.strip()
            if has_artifact_override
            else "(none)"
        )

        prompt_with_fallback = f"""You are a professional museum guide currently presenting: {artifact_name}.

LANGUAGE
- Always respond in {language_label}.

STYLE POLICY (tone and delivery)
- Museum persona baseline: {museum_persona}
- Artifact-level override (highest priority): {artifact_override}
- Fallback style template (use only when the two lines above are insufficient):
{fallback_template if has_fallback else "(none)"}

CONTENT POLICY (facts and grounding)
- Primary source of truth is the curated artifact facts below.
- Do not invent names, dates, numbers, or events.
- If the requested detail is missing from the curated facts, say:
  "The museum currently has no verified information about that detail."

CURATED ARTIFACT FACTS
{context_text}

PRIORITY ORDER
1) Artifact-level override
2) Museum persona baseline
3) Fallback style template
4) General safe conversational behavior
"""

        # Guard against oversized instructions. Drop fallback section first.
        max_chars = int(os.getenv("VOICE_SYSTEM_PROMPT_MAX_CHARS", "12000"))
        if len(prompt_with_fallback) <= max_chars:
            return prompt_with_fallback, {
                "has_museum_persona": has_museum_persona,
                "has_artifact_override": has_artifact_override,
                "has_fallback": has_fallback,
                "context_chars": len(context_text),
            }

        prompt_without_fallback = f"""You are a professional museum guide currently presenting: {artifact_name}.

LANGUAGE
- Always respond in {language_label}.

STYLE POLICY (tone and delivery)
- Museum persona baseline: {museum_persona}
- Artifact-level override (highest priority): {artifact_override}

CONTENT POLICY (facts and grounding)
- Primary source of truth is the curated artifact facts below.
- Do not invent names, dates, numbers, or events.
- If the requested detail is missing from the curated facts, say:
  "The museum currently has no verified information about that detail."

CURATED ARTIFACT FACTS
{context_text}

PRIORITY ORDER
1) Artifact-level override
2) Museum persona baseline
3) General safe conversational behavior
"""
        logger.warning(
            "⚠️ System prompt exceeded max chars (%d). Fallback style template was removed.",
            max_chars,
        )
        return prompt_without_fallback, {
            "has_museum_persona": has_museum_persona,
            "has_artifact_override": has_artifact_override,
            "has_fallback": False,
            "context_chars": len(context_text),
        }


async def handle_persona_websocket(websocket: WebSocket, artifact: dict, language: str = "vi"):
    """Entry point for websocket endpoint."""
    handler = GeminiLiveHandler(artifact, language, artifact.get("id"))
    await handler.handle_websocket(websocket)
