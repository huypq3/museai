"""
Camera tour module for live camera mode with automatic AI commentary.
Detects exhibit changes and generates short commentary text.
"""

import os
import logging
from typing import Dict, Optional
from google import genai
from google.cloud import firestore

from vision.recognizer import recognize_exhibit


logger = logging.getLogger(__name__)


async def analyze_frame(
    image_bytes: bytes,
    museum_id: str,
    last_exhibit_id: Optional[str] = None,
    project_id: str | None = None
) -> Dict:
    """
    Analyze camera frame and detect whether a new exhibit appears.
    
    Args:
        image_bytes: Image data
        museum_id: Museum ID
        last_exhibit_id: Previous exhibit ID (to avoid repeats)
        project_id: GCP project ID
    
    Returns:
        Dict: {
            "same": bool,  # True if same exhibit as previous frame
            "exhibit_id": str,
            "confidence": float
        }
    """
    try:
        logger.info(f"Analyzing camera frame for museum: {museum_id}")
        
        # Run exhibit recognition.
        result = await recognize_exhibit(image_bytes, museum_id, project_id)
        
        exhibit_id = result["exhibit_id"]
        confidence = result["confidence"]
        
        # Check whether the exhibit is unchanged.
        if exhibit_id == last_exhibit_id:
            logger.info(f"Same exhibit as last frame: {exhibit_id}")
            return {
                "same": True,
                "exhibit_id": exhibit_id,
                "confidence": confidence
            }
        
        # New exhibit detected.
        logger.info(f"New exhibit detected: {exhibit_id}")
        return {
            "same": False,
            "exhibit_id": exhibit_id,
            "confidence": confidence
        }
        
    except Exception as e:
        logger.error(f"Error analyzing frame: {e}", exc_info=True)
        return {
            "same": False,
            "exhibit_id": "unknown",
            "confidence": 0.0
        }


async def generate_commentary(
    exhibit_id: str,
    language: str = "vi",
    project_id: str | None = None
) -> str:
    """
    Generate short commentary text for live camera tour.
    
    Args:
        exhibit_id: Exhibit ID
        language: Output language (vi, en, fr, zh, ja, ko)
        project_id: GCP project ID
    
    Returns:
        str: Commentary text (1-2 short sentences)
    """
    try:
        logger.info(f"Generating commentary for exhibit: {exhibit_id}")
        resolved_project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        if not resolved_project_id:
            raise ValueError("GOOGLE_CLOUD_PROJECT environment variable not set")
        
        # Load exhibit and persona data from Firestore.
        db = firestore.AsyncClient(project=resolved_project_id)
        
        exhibit_ref = db.collection("exhibits").document(exhibit_id)
        exhibit_doc = await exhibit_ref.get()
        
        if not exhibit_doc.exists:
            return "Sorry, I could not find information for this exhibit."
        
        exhibit_data = exhibit_doc.to_dict()
        name = exhibit_data.get("name", "this exhibit")
        description = exhibit_data.get("short_description", exhibit_data.get("description", ""))
        
        # Load persona data if available.
        persona_text = ""
        persona_id = exhibit_data.get("persona_id")
        if persona_id:
            persona_ref = db.collection("personas").document(persona_id)
            persona_doc = await persona_ref.get()
            
            if persona_doc.exists:
                persona_data = persona_doc.to_dict()
                opening_line = persona_data.get("opening_line", "")
                if opening_line:
                    persona_text = f"Opening line: {opening_line}"
        
        # Generate commentary with Gemini.
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Language label map.
        language_map = {
            "vi": "Vietnamese",
            "en": "English",
            "fr": "French",
            "zh": "Chinese",
            "ja": "Japanese",
            "ko": "Korean",
        }
        lang_name = language_map.get(language, "Vietnamese")

        prompt = f"""You are a museum guide. The camera has detected a new exhibit.

Create a SHORT introduction (1-2 sentences, max 30 words) using:
- Name: {name}
- Description: {description}
{persona_text}

Style: Friendly and attention-grabbing.
Language: {lang_name}

Return only the introduction sentence(s), without extra explanation.
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
        return "Sorry, an error occurred while generating commentary."
