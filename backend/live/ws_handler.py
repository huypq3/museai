"""
WebSocket handler cho Gemini Live API.
Xử lý voice conversation real-time giữa khách tham quan và AI hướng dẫn viên.
"""

import os
import asyncio
import base64
import json
import logging
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
        
    async def handle_websocket(self, websocket: WebSocket):
        """
        Xử lý WebSocket connection từ client.
        
        Args:
            websocket: FastAPI WebSocket instance
        """
        await websocket.accept()
        logger.info(f"WebSocket connected for artifact: {self.artifact.get('name')}")
        
        try:
            # Kết nối Gemini Live API
            config = {
                "response_modalities": ["AUDIO"],
            }
            
            # Tạo system instruction đúng format
            system_instruction_content = types.Content(
                parts=[types.Part(text=self.system_instruction)]
            )
            
            # Kết nối Gemini Live
            async with self.client.aio.live.connect(
                model="gemini-2.5-flash-native-audio-latest",
                config=config,
                system_instruction=system_instruction_content
            ) as session:
                self.session = session
                logger.info("Connected to Gemini Live API")
                
                # Tạo 2 tasks: 1 để nhận từ client, 1 để gửi từ Gemini
                receive_task = asyncio.create_task(
                    self._receive_from_client(websocket, session)
                )
                send_task = asyncio.create_task(
                    self._send_to_client(websocket, session)
                )
                
                # Chờ một trong 2 tasks kết thúc
                done, pending = await asyncio.wait(
                    [receive_task, send_task],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # Hủy task còn lại
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                
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
                        
                        # Gửi audio cho Gemini
                        await session.send(
                            types.Part(inline_data=types.Blob(
                                mime_type="audio/pcm",
                                data=audio_bytes
                            )),
                            end_of_turn=False
                        )
                        logger.debug("Sent audio chunk to Gemini")
                
                elif msg_type == "end_of_turn":
                    # Client báo hiệu kết thúc lượt nói
                    await session.send(end_of_turn=True)
                    logger.debug("Sent end_of_turn to Gemini")
                
                elif msg_type == "text":
                    # Client gửi text message (fallback)
                    text = message.get("data")
                    if text:
                        await session.send(text, end_of_turn=True)
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
            # Turn generator: Gemini tạo ra các turns (lượt trả lời)
            async for turn in session.receive():
                logger.debug(f"Received turn from Gemini")
                
                # Mỗi turn có thể có nhiều parts
                for part in turn.parts:
                    # Kiểm tra xem có audio data không
                    if part.inline_data:
                        audio_data = part.inline_data.data
                        
                        # Encode sang base64 để gửi qua WebSocket
                        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                        
                        # Gửi về client
                        await websocket.send_json({
                            "type": "audio",
                            "data": audio_base64,
                            "mime_type": part.inline_data.mime_type
                        })
                        logger.debug(f"Sent audio chunk to client ({len(audio_data)} bytes)")
                    
                    # Nếu có text (fallback hoặc transcript)
                    elif part.text:
                        await websocket.send_json({
                            "type": "text",
                            "data": part.text
                        })
                        logger.debug(f"Sent text to client: {part.text[:50]}...")
                
                # Báo hiệu kết thúc turn
                await websocket.send_json({
                    "type": "turn_complete"
                })
                logger.debug("Turn complete")
                
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
