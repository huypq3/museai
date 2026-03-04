"""
Vision Recognizer - Nhận diện hiện vật bằng Gemini Vision.
Sử dụng Gemini 2.5 Flash multimodal để match ảnh với artifacts trong bảo tàng.
"""

import os
import json
import logging
from typing import Dict, Optional
from google import genai
from google.genai import types
from google.cloud import firestore


logger = logging.getLogger(__name__)


async def recognize_artifact(
    image_bytes: bytes,
    museum_id: str,
    project_id: str = "museai-2026"
) -> Dict:
    """
    Nhận diện hiện vật từ ảnh bằng Gemini Vision.
    
    Args:
        image_bytes: Image data (JPEG/PNG)
        museum_id: ID của bảo tàng
        project_id: GCP project ID
    
    Returns:
        Dict: {
            "artifact_id": str,
            "confidence": float (0.0-1.0),
            "reasoning": str,
            "found": bool
        }
    """
    try:
        logger.info(f"Recognizing artifact for museum: {museum_id}")
        
        # Bước 1: Lấy danh sách artifacts từ Firestore
        db = firestore.AsyncClient(project=project_id)
        artifacts_ref = db.collection("artifacts").where("museum_id", "==", museum_id)
        artifacts_docs = await artifacts_ref.get()
        
        if not artifacts_docs:
            logger.warning(f"No artifacts found for museum: {museum_id}")
            return {
                "artifact_id": "unknown",
                "confidence": 0.0,
                "reasoning": f"No artifacts registered for museum {museum_id}",
                "found": False
            }
        
        # Tạo artifact list string
        artifact_list = []
        for doc in artifacts_docs:
            data = doc.to_dict()
            artifact_id = doc.id
            name = data.get("name", "Unknown")
            short_desc = data.get("short_description", data.get("description", "No description"))
            artifact_list.append(f"{artifact_id}: {name} — {short_desc}")
        
        artifact_list_str = "\n".join(artifact_list)
        logger.info(f"Found {len(artifact_list)} artifacts for matching")
        
        # Bước 2: Gọi Gemini Vision
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Tạo image part
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg"
        )
        
        # Tạo prompt
        prompt = f"""Nhìn vào ảnh này và xác định đây là hiện vật nào trong danh sách bảo tàng.

Phân tích kỹ hình dạng, màu sắc, kích thước, đặc điểm nổi bật trong ảnh.
So sánh với mô tả của từng hiện vật trong danh sách.

Chỉ trả về JSON format (KHÔNG có markdown, KHÔNG có text khác):
{{"artifact_id": "...", "confidence": 0.0-1.0, "reasoning": "..."}}

Nếu không tìm thấy hoặc không chắc chắn:
{{"artifact_id": "unknown", "confidence": 0.0, "reasoning": "..."}}

DANH SÁCH HIỆN VẬT:
{artifact_list_str}
"""
        
        # Gọi Gemini Vision
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[image_part, prompt]
        )
        
        response_text = response.text.strip()
        logger.debug(f"Gemini response: {response_text}")
        
        # Bước 3: Parse JSON response
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            # Extract JSON from markdown
            lines = response_text.split("\n")
            json_lines = []
            in_code_block = False
            for line in lines:
                if line.startswith("```"):
                    in_code_block = not in_code_block
                    continue
                if in_code_block or (not line.startswith("```")):
                    json_lines.append(line)
            response_text = "\n".join(json_lines).strip()
        
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {response_text}")
            return {
                "artifact_id": "unknown",
                "confidence": 0.0,
                "reasoning": f"Failed to parse Gemini response: {str(e)}",
                "found": False
            }
        
        # Validate result
        artifact_id = result.get("artifact_id", "unknown")
        confidence = float(result.get("confidence", 0.0))
        reasoning = result.get("reasoning", "")
        
        # Nếu confidence thấp → set artifact_id = unknown
        if confidence < 0.5:
            artifact_id = "unknown"
        
        found = artifact_id != "unknown"
        
        logger.info(f"Recognition result: {artifact_id} (confidence={confidence:.2f})")
        
        return {
            "artifact_id": artifact_id,
            "confidence": confidence,
            "reasoning": reasoning,
            "found": found
        }
        
    except Exception as e:
        logger.error(f"Error recognizing artifact: {e}", exc_info=True)
        return {
            "artifact_id": "unknown",
            "confidence": 0.0,
            "reasoning": f"Error: {str(e)}",
            "found": False
        }
