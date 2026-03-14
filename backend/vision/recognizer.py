"""
Vision recognizer for matching exhibits with Gemini Vision.
Uses Gemini 2.5 Flash multimodal model for museum exhibit matching.
"""

import os
import json
import logging
from typing import Dict, Optional
from google import genai
from google.genai import types
from google.cloud import firestore


logger = logging.getLogger(__name__)
VISION_DEBUG = os.getenv("VISION_DEBUG", "0") == "1"


async def recognize_exhibit(
    image_bytes: bytes,
    museum_id: str,
    project_id: str | None = None
) -> Dict:
    """
    Recognize an exhibit from an image with Gemini Vision.
    
    Args:
        image_bytes: Image data (JPEG/PNG)
        museum_id: Museum ID
        project_id: GCP project ID
    
    Returns:
        Dict: {
            "exhibit_id": str,
            "confidence": float (0.0-1.0),
            "reasoning": str,
            "found": bool
        }
    """
    try:
        logger.info(f"Recognizing exhibit for museum: {museum_id}")
        logger.info("Vision input image size: %d bytes", len(image_bytes))
        resolved_project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        if not resolved_project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set")
        
        # Step 1: Load exhibit candidates from Firestore.
        db = firestore.AsyncClient(project=resolved_project_id)
        exhibits_ref = db.collection("exhibits").where("museum_id", "==", museum_id)
        exhibits_docs = await exhibits_ref.get()
        
        if not exhibits_docs:
            logger.warning(f"No exhibits found for museum: {museum_id}")
            return {
                "exhibit_id": "unknown",
                "confidence": 0.0,
                "reasoning": f"No exhibits registered for museum {museum_id}",
                "found": False
            }
        
        # Build candidate exhibit list.
        exhibit_list = []
        for doc in exhibits_docs:
            data = doc.to_dict()
            exhibit_id = doc.id
            name = data.get("name", "Unknown")
            short_desc = data.get("short_description", data.get("description", "No description"))
            exhibit_list.append(f"{exhibit_id}: {name} — {short_desc}")
        
        exhibit_list_str = "\n".join(exhibit_list)
        logger.info(f"Found {len(exhibit_list)} exhibits for matching")
        if VISION_DEBUG:
            logger.info("Vision candidates: %s", [x.split(":", 1)[0] for x in exhibit_list][:30])
        
        # Step 2: Call Gemini Vision.
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Build image part.
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg"
        )
        
        # Build vision prompt.
        prompt = f"""Inspect this image and identify which exhibit matches the museum list.

Carefully compare visible shape, color, scale, and distinguishing features
against each listed exhibit description.

Return ONLY valid JSON (no markdown, no extra text):
{{"exhibit_id": "...", "confidence": 0.0-1.0, "reasoning": "..."}}

If no confident match is possible, return:
{{"exhibit_id": "unknown", "confidence": 0.0, "reasoning": "..."}}

EXHIBIT CANDIDATES:
{exhibit_list_str}
"""
        if VISION_DEBUG:
            logger.info("Vision prompt chars=%d", len(prompt))
        
        # Invoke Gemini Vision.
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[image_part, prompt]
        )
        
        response_text = response.text.strip()
        if VISION_DEBUG:
            logger.info("Gemini raw response: %s", response_text[:1500])
        
        # Step 3: Parse JSON response.
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
                "exhibit_id": "unknown",
                "confidence": 0.0,
                "reasoning": f"Failed to parse Gemini response: {str(e)}",
                "found": False
            }
        
        # Validate output.
        exhibit_id = result.get("exhibit_id", "unknown")
        confidence = float(result.get("confidence", 0.0))
        reasoning = result.get("reasoning", "")
        if VISION_DEBUG:
            logger.info("Gemini parsed: exhibit_id=%s confidence=%.3f reasoning=%s", exhibit_id, confidence, str(reasoning)[:500])
        
        # If confidence is too low, downgrade to unknown.
        if confidence < 0.5:
            exhibit_id = "unknown"
        
        found = exhibit_id != "unknown"
        
        logger.info(f"Recognition result: {exhibit_id} (confidence={confidence:.2f})")
        
        return {
            "exhibit_id": exhibit_id,
            "confidence": confidence,
            "reasoning": reasoning,
            "found": found
        }
        
    except Exception as e:
        logger.error(f"Error recognizing exhibit: {e}", exc_info=True)
        return {
            "exhibit_id": "unknown",
            "confidence": 0.0,
            "reasoning": f"Error: {str(e)}",
            "found": False
        }
