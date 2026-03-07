"""
Camera tour module for live camera mode with automatic AI commentary.
Detects artifact changes and generates short commentary text.
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
    Analyze camera frame and detect whether a new artifact appears.
    
    Args:
        image_bytes: Image data
        museum_id: Museum ID
        last_artifact_id: Previous artifact ID (to avoid repeats)
        project_id: GCP project ID
    
    Returns:
        Dict: {
            "same": bool,  # True if same artifact as previous frame
            "artifact_id": str,
            "confidence": float
        }
    """
    try:
        logger.info(f"Analyzing camera frame for museum: {museum_id}")
        
        # Run artifact recognition.
        result = await recognize_artifact(image_bytes, museum_id, project_id)
        
        artifact_id = result["artifact_id"]
        confidence = result["confidence"]
        
        # Check whether the artifact is unchanged.
        if artifact_id == last_artifact_id:
            logger.info(f"Same artifact as last frame: {artifact_id}")
            return {
                "same": True,
                "artifact_id": artifact_id,
                "confidence": confidence
            }
        
        # New artifact detected.
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
    Generate short commentary text for live camera tour.
    
    Args:
        artifact_id: Artifact ID
        language: Output language (vi, en, fr, zh, ja, ko)
        project_id: GCP project ID
    
    Returns:
        str: Commentary text (1-2 short sentences)
    """
    try:
        logger.info(f"Generating commentary for artifact: {artifact_id}")
        
        # Load artifact and persona data from Firestore.
        db = firestore.AsyncClient(project=project_id)
        
        artifact_ref = db.collection("exhibits").document(artifact_id)
        artifact_doc = await artifact_ref.get()
        if not artifact_doc.exists:
            artifact_ref = db.collection("artifacts").document(artifact_id)
            artifact_doc = await artifact_ref.get()
        
        if not artifact_doc.exists:
            return "Sorry, I could not find information for this artifact."
        
        artifact_data = artifact_doc.to_dict()
        name = artifact_data.get("name", "this artifact")
        description = artifact_data.get("short_description", artifact_data.get("description", ""))
        
        # Load persona data if available.
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

        prompt = f"""You are a museum guide. The camera has detected a new artifact.

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
