"""
WebSocket handler cho Gemini Live API.
Xử lý voice conversation real-time giữa khách tham quan và AI hướng dẫn viên.
"""

import os
import asyncio
import base64
import json
import logging
import time
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from persona.prompt_builder import build_prompt


logger = logging.getLogger(__name__)


class GeminiLiveHandler:
    """Handler cho Gemini Live API WebSocket session."""
    
    def __init__(self, artifact: dict, language: str = "vi"):
        """
        Khởi tạo handler.
        
        Args:
            artifact: Thông tin artifact và persona từ Firestore
            language: Mã ngôn ngữ (vi, en, fr, zh, ja, ko)
        """
        self.artifact = artifact
        self.language = language
        self.system_instruction = build_prompt(artifact, language)
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        self.client = genai.Client(api_key=api_key)
        self.session: Optional[genai.types.LiveSession] = None
        self.last_audio_chunk_at_ms: int = 0
        
    async def handle_websocket(self, websocket: WebSocket):
        """
        Xử lý WebSocket connection từ client.
        
        Args:
            websocket: FastAPI WebSocket instance
        """
        await websocket.accept()
        logger.info(f"WebSocket connected for artifact: {self.artifact.get('name')}")
        
        try:
            # Tạo system instruction đúng format
            system_instruction_content = types.Content(
                parts=[types.Part(text=self.system_instruction)]
            )

            # Ruby-inspired configurable knobs (map from voicechat.service.ts)
            max_output_tokens = int(os.getenv("VOICE_MAX_OUTPUT_TOKENS", "800"))
            silence_duration_ms = int(os.getenv("VOICE_SILENCE_MS", "200"))
            prefix_padding_ms = int(os.getenv("VOICE_PREFIX_PADDING_MS", "200"))
            start_sensitivity = os.getenv("VOICE_START_SENSITIVITY", "START_SENSITIVITY_HIGH")
            end_sensitivity = os.getenv("VOICE_END_SENSITIVITY", "END_SENSITIVITY_LOW")
            voice_name = os.getenv("VOICE_NAME", "Kore")
            temperature = float(os.getenv("VOICE_TEMPERATURE", "0.55"))
            candidate_count = int(os.getenv("VOICE_CANDIDATE_COUNT", "1"))
            model_name = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
            
            # Kết nối Gemini Live API với config + VAD
            config = {
                "generation_config": {
                    "response_modalities": ["AUDIO"],
                    "thinking_config": {
                        "include_thoughts": False,
                        "thinking_budget": 0,
                    },
                    "speech_config": {
                        "voice_config": {"prebuilt_voice_config": {"voice_name": voice_name}}
                    },
                    "temperature": temperature,
                    "candidate_count": candidate_count,
                    "max_output_tokens": max_output_tokens,
                },
                "system_instruction": system_instruction_content,
                # Gemini server-side VAD - tự động detect khi user nói xong
                "realtime_input_config": {
                    "automatic_activity_detection": {
                        # Manual turn mode: client controls end_of_turn explicitly.
                        "disabled": True,
                        "start_of_speech_sensitivity": start_sensitivity,
                        "end_of_speech_sensitivity": end_sensitivity,
                        "prefix_padding_ms": prefix_padding_ms,
                        "silence_duration_ms": silence_duration_ms,
                    }
                },
            }
            logger.info(
                "✅ Live config: model=%s, voice=%s, max_tokens=%s, silence_ms=%s, "
                "start_sens=%s, end_sens=%s, thinking_budget=0",
                model_name,
                voice_name,
                max_output_tokens,
                silence_duration_ms,
                start_sensitivity,
                end_sensitivity,
            )
            
            # Kết nối Gemini Live
            async with self.client.aio.live.connect(
                model=model_name,
                config=config
            ) as session:
                self.session = session
                logger.info("Connected to Gemini Live API")
                
                # Gửi welcome message để client biết đã ready
                await websocket.send_json({
                    "type": "ready",
                    "message": "Connected to Gemini Live"
                })
                
                # Tạo 2 tasks: 1 để nhận từ client, 1 để gửi từ Gemini
                receive_task = asyncio.create_task(
                    self._receive_from_client(websocket, session)
                )
                send_task = asyncio.create_task(
                    self._send_to_client(websocket, session)
                )
                
                # Chờ CẢ HAI tasks hoàn thành (hoặc một trong hai bị lỗi)
                # Dùng gather để cả 2 tasks chạy song song
                try:
                    await asyncio.gather(receive_task, send_task)
                except Exception as e:
                    logger.error(f"Task error: {e}")
                    # Cancel tasks còn lại
                    receive_task.cancel()
                    send_task.cancel()
                
                logger.info("WebSocket session ended")
                
        except WebSocketDisconnect:
            logger.info("Client disconnected")
        except Exception as e:
            logger.error(f"Error in WebSocket handler: {e}", exc_info=True)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
            except:
                pass
        finally:
            try:
                await websocket.close()
            except:
                pass
    
    async def _receive_from_client(self, websocket: WebSocket, session):
        """
        Nhận audio data từ client và gửi cho Gemini.
        
        Args:
            websocket: FastAPI WebSocket
            session: Gemini Live session
        """
        try:
            while True:
                # Nhận message từ client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                msg_type = message.get("type")
                
                if msg_type == "audio":
                    # Client gửi audio data (base64 encoded)
                    audio_base64 = message.get("data")
                    if audio_base64:
                        audio_bytes = base64.b64decode(audio_base64)
                        self.last_audio_chunk_at_ms = int(time.monotonic() * 1000)
                        logger.info(f"📥 Received from client: type={msg_type}, size={len(audio_bytes)} bytes")
                        
                        # Gửi audio cho Gemini - sử dụng new API với types
                        await session.send(
                            input=types.LiveClientRealtimeInput(
                                media_chunks=[
                                    types.Blob(
                                        data=audio_bytes,
                                        mime_type="audio/pcm;rate=16000"
                                    )
                                ]
                            )
                        )
                        logger.debug("Sent audio chunk to Gemini")
                
                elif msg_type == "end_of_turn":
                    # Manual turn mode: explicitly ask Gemini to start generation.
                    logger.info("📥 Received end_of_turn from client, signaling Gemini...")
                    await session.send(input=" ", end_of_turn=True)
                    logger.info("✅ Sent end_of_turn signal to Gemini")
                
                elif msg_type == "interrupt":
                    # Client báo hiệu muốn interrupt AI đang nói
                    logger.info("📥 Received interrupt from client")
                    # Manual mode: stop playback on client side first.
                    # New turn will be started by user recording + end_of_turn.
                    pass

                elif msg_type == "audio_stream_end":
                    # Client-only signal for observability/latency tracking.
                    # Do not force end_of_turn here; Gemini VAD should decide.
                    now_ms = int(time.monotonic() * 1000)
                    since_last_audio = now_ms - self.last_audio_chunk_at_ms
                    logger.info(
                        "📥 Received audio_stream_end from client (since_last_audio=%sms)",
                        since_last_audio,
                    )
                
                elif msg_type == "text":
                    # Client gửi text message (fallback)
                    text = message.get("data")
                    if text:
                        await session.send(input=text, end_of_turn=True)
                        logger.debug(f"Sent text to Gemini: {text}")
                
                else:
                    logger.warning(f"Unknown message type: {msg_type}")
                    
        except WebSocketDisconnect:
            logger.info("Client disconnected in receive loop")
            raise
        except Exception as e:
            logger.error(f"Error receiving from client: {e}", exc_info=True)
            raise
    
    async def _send_to_client(self, websocket: WebSocket, session):
        """
        Nhận response từ Gemini và stream về client.
        
        Args:
            websocket: FastAPI WebSocket
            session: Gemini Live session
        """
        try:
            async for response in session.receive():
                logger.info(f"📤 Gemini response: data={len(response.data) if response.data else 0} bytes, text={response.text[:50] if response.text else None}, turn_complete={response.server_content.turn_complete if response.server_content else False}")
                
                # Xử lý audio data
                if response.data:
                    audio_b64 = base64.b64encode(response.data).decode("utf-8")
                    await websocket.send_json({
                        "type": "audio_chunk",
                        "audio": audio_b64
                    })
                    logger.info(f"✅ Sent audio chunk to client ({len(response.data)} bytes, base64: {len(audio_b64)} chars)")
                else:
                    logger.debug("No audio data in this response")

                # Xử lý text transcript
                if response.text:
                    await websocket.send_json({
                        "type": "transcript",
                        "text": response.text
                    })
                    logger.debug(f"Sent text to client: {response.text[:50]}...")

                # Xử lý turn complete + VAD events
                if response.server_content:
                    if getattr(response.server_content, "interrupted", False):
                        await websocket.send_json({
                            "type": "interrupted"
                        })
                        logger.info("⚠️ Gemini interrupted current response")

                    # VAD: User transcript (realtime)
                    if hasattr(response.server_content, 'input_transcription'):
                        if response.server_content.input_transcription:
                            await websocket.send_json({
                                "type": "user_transcript",
                                "text": response.server_content.input_transcription.text
                            })
                            logger.info(f"👤 User said: {response.server_content.input_transcription.text[:50]}...")
                    
                    # Turn complete
                    if response.server_content.turn_complete:
                        await websocket.send_json({
                            "type": "turn_complete"
                        })
                        logger.info("✅ Turn complete - ready for next question")

        except WebSocketDisconnect:
            logger.info("Client disconnected in send loop")
            raise
        except Exception as e:
            logger.error(f"Error sending to client: {e}", exc_info=True)
            raise


async def handle_persona_websocket(
    websocket: WebSocket,
    artifact: dict,
    language: str = "vi"
):
    """
    Entry point cho WebSocket endpoint.
    
    Args:
        websocket: FastAPI WebSocket instance
        artifact: Thông tin artifact và persona từ Firestore
        language: Mã ngôn ngữ
    """
    handler = GeminiLiveHandler(artifact, language)
    await handler.handle_websocket(websocket)
