"""
Camera Tour - Live camera mode với AI commentary tự động.
Phát hiện hiện vật mới và generate commentary ngắn gọn.
"""

import os
import logging
from typing import Dict, Optional
from google import genai
from google.cloud import firestore

from vision.recognizer import recognize_artifact


logger = logging.getLogger(__name__)


async def analyze_frame(
    image_bytes: bytes,
    museum_id: str,
    last_artifact_id: Optional[str] = None,
    project_id: str = "museai-2026"
) -> Dict:
    """
    Phân tích frame từ camera để phát hiện hiện vật mới.
    
    Args:
        image_bytes: Image data
        museum_id: ID của bảo tàng
        last_artifact_id: ID của artifact trước đó (để tránh repeat)
        project_id: GCP project ID
    
    Returns:
        Dict: {
            "same": bool,  # True nếu cùng artifact với lần trước
            "artifact_id": str,
            "confidence": float
        }
    """
    try:
        logger.info(f"Analyzing camera frame for museum: {museum_id}")
        
        # Nhận diện artifact
        result = await recognize_artifact(image_bytes, museum_id, project_id)
        
        artifact_id = result["artifact_id"]
        confidence = result["confidence"]
        
        # Kiểm tra xem có phải cùng artifact không
        if artifact_id == last_artifact_id:
            logger.info(f"Same artifact as last frame: {artifact_id}")
            return {
                "same": True,
                "artifact_id": artifact_id,
                "confidence": confidence
            }
        
        # Artifact mới
        logger.info(f"New artifact detected: {artifact_id}")
        return {
            "same": False,
            "artifact_id": artifact_id,
            "confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"Error analyzing frame: {e}", exc_info=True)
        return {
            "same": False,
            "artifact_id": "unknown",
            "confidence": 0.0
        }


async def generate_commentary(
    artifact_id: str,
    language: str = "vi",
    project_id: str = "museai-2026"
) -> str:
    """
    Generate câu commentary ngắn cho Live Camera Tour.
    
    Args:
        artifact_id: ID của artifact
        language: Ngôn ngữ (vi, en, fr, zh, ja, ko)
        project_id: GCP project ID
    
    Returns:
        str: Commentary text (1-2 câu ngắn)
    """
    try:
        logger.info(f"Generating commentary for artifact: {artifact_id}")
        
        # Lấy artifact + persona từ Firestore
        db = firestore.AsyncClient(project=project_id)
        
        artifact_ref = db.collection("artifacts").document(artifact_id)
        artifact_doc = await artifact_ref.get()
        
        if not artifact_doc.exists:
            return "Xin lỗi, tôi không tìm thấy thông tin về hiện vật này."
        
        artifact_data = artifact_doc.to_dict()
        name = artifact_data.get("name", "hiện vật này")
        description = artifact_data.get("short_description", artifact_data.get("description", ""))
        
        # Lấy persona nếu có
        persona_text = ""
        persona_id = artifact_data.get("persona_id")
        if persona_id:
            persona_ref = db.collection("personas").document(persona_id)
            persona_doc = await persona_ref.get()
            
            if persona_doc.exists:
                persona_data = persona_doc.to_dict()
                opening_line = persona_data.get("opening_line", "")
                if opening_line:
                    persona_text = f"Opening line: {opening_line}"
        
        # Generate commentary bằng Gemini
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Language map
        language_map = {
            "vi": "tiếng Việt",
            "en": "English",
            "fr": "français",
            "zh": "中文",
            "ja": "日本語",
            "ko": "한국어"
        }
        lang_name = language_map.get(language, "tiếng Việt")
        
        prompt = f"""Bạn là hướng dẫn viên bảo tàng. Camera vừa phát hiện hiện vật mới.

Tạo câu giới thiệu NGẮN GỌN (1-2 câu, tối đa 30 từ) về:
- Tên: {name}
- Mô tả: {description}
{persona_text}

Phong cách: Thân thiện, thu hút sự chú ý.
Ngôn ngữ: {lang_name}

CHỈ trả về câu giới thiệu, KHÔNG giải thích thêm.
"""
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        commentary = response.text.strip()
        logger.info(f"Generated commentary: {commentary[:50]}...")
        
        return commentary
        
    except Exception as e:
        logger.error(f"Error generating commentary: {e}", exc_info=True)
        return "Xin lỗi, đã có lỗi khi tạo commentary."
