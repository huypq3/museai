"""
Persona prompt fallback builder for MuseAI live sessions.
This is a lightweight fallback template used only when museum/exhibit
level prompt data is missing.
"""

from typing import Dict, Any


def build_prompt(exhibit: Dict[str, Any], language: str = "vi") -> str:
    """
    Build a concise fallback instruction for Gemini Live API.
    
    Args:
        exhibit: Exhibit dict with optional nested persona fields.
        language: Language code (vi, en, es, fr, zh, ja, ko)
    
    Returns:
        str: Fallback prompt text
    """
    exhibit_type = exhibit.get("type", "object")
    
    if exhibit_type == "person":
        return _build_person_prompt(exhibit, language)
    elif exhibit_type == "artwork":
        return _build_artwork_prompt(exhibit, language)
    else:
        return _build_object_prompt(exhibit, language)


def _build_person_prompt(exhibit: Dict[str, Any], language: str) -> str:
    """Fallback for historical person exhibits."""
    name = exhibit.get("name", "this historical figure")
    era = exhibit.get("era", "")
    description = exhibit.get("description", "")

    persona = exhibit.get("persona", {})
    subject_role = persona.get("subject_role", "historical figure")
    storytelling_style = persona.get("storytelling_style", "clear, warm, and educational")
    opening_line = persona.get("opening_line", f"Welcome. Let me briefly introduce {name}.")
    famous_quotes = persona.get("famous_quotes", [])
    key_events = persona.get("key_events", [])
    topics_to_emphasize = persona.get("topics_to_emphasize", [])
    topics_to_avoid = persona.get("topics_to_avoid", [])

    language_instructions = _get_language_instructions(language)

    prompt = f"""You are a museum guide describing {name} ({subject_role}, era: {era}).

Speaking style: {storytelling_style}
Suggested opening line: "{opening_line}"

Background:
{description}

Key events:
{_format_list(key_events)}

Topics to emphasize:
{_format_list(topics_to_emphasize)}

Topics to avoid:
{_format_list(topics_to_avoid)}

Quotes to use only when relevant:
{_format_quotes(famous_quotes)}

Rules:
- Do not roleplay as {name}; speak as a guide.
- Keep answers concise and complete.
- If uncertain, say you are unsure instead of inventing facts.
- {language_instructions}
"""
    return prompt.strip()


def _build_artwork_prompt(exhibit: Dict[str, Any], language: str) -> str:
    """Fallback for artwork exhibits."""
    name = exhibit.get("name", "this artwork")
    era = exhibit.get("era", "")
    description = exhibit.get("description", "")

    persona = exhibit.get("persona", {})
    storytelling_style = persona.get("storytelling_style", "clear, vivid, and emotionally balanced")
    opening_line = persona.get("opening_line", f"Welcome. This is {name}, a remarkable artwork.")
    key_events = persona.get("key_events", [])
    topics_to_emphasize = persona.get("topics_to_emphasize", [])
    topics_to_avoid = persona.get("topics_to_avoid", [])

    language_instructions = _get_language_instructions(language)

    prompt = f"""You are a museum art guide explaining "{name}" (era: {era}).

Speaking style: {storytelling_style}
Suggested opening line: "{opening_line}"

Artwork context:
{description}

Historical context:
{_format_list(key_events)}

Analysis priorities:
{_format_list(topics_to_emphasize)}

Avoid topics:
{_format_list(topics_to_avoid)}

Rules:
- Explain clearly with concrete visual details.
- Keep responses concise and complete.
- If uncertain, say you are unsure instead of inventing facts.
- {language_instructions}
"""
    return prompt.strip()


def _build_object_prompt(exhibit: Dict[str, Any], language: str) -> str:
    """Fallback for object/cultural exhibit entries."""
    name = exhibit.get("name", "this exhibit")
    era = exhibit.get("era", "")
    description = exhibit.get("description", "")

    persona = exhibit.get("persona", {})
    storytelling_style = persona.get("storytelling_style", "clear, practical, and engaging")
    opening_line = persona.get("opening_line", f"Welcome. This is {name}, an important exhibit.")
    key_events = persona.get("key_events", [])
    topics_to_emphasize = persona.get("topics_to_emphasize", [])
    topics_to_avoid = persona.get("topics_to_avoid", [])

    language_instructions = _get_language_instructions(language)

    prompt = f"""You are a museum guide introducing "{name}" (era: {era}).

Speaking style: {storytelling_style}
Suggested opening line: "{opening_line}"

Exhibit context:
{description}

Related history:
{_format_list(key_events)}

Explanation priorities:
{_format_list(topics_to_emphasize)}

Avoid topics:
{_format_list(topics_to_avoid)}

Rules:
- Explain function, material, and historical significance.
- Keep responses concise and complete.
- If uncertain, say you are unsure instead of inventing facts.
- {language_instructions}
"""
    return prompt.strip()


def _get_language_instructions(language: str) -> str:
    """Return output-language guidance for the assistant."""
    language_map = {
        "vi": "Reply in Vietnamese with a friendly and natural tone.",
        "en": "Reply in English with a friendly and natural tone.",
        "es": "Reply in Spanish with a friendly and natural tone.",
        "fr": "Reply in French with a friendly and natural tone.",
        "zh": "Reply in Chinese with a friendly and natural tone.",
        "ja": "Reply in Japanese with a friendly and natural tone.",
        "ko": "Reply in Korean with a friendly and natural tone.",
    }
    return language_map.get(language, language_map["en"])


def _format_list(items: list) -> str:
    """Format list as bullet points."""
    if not items:
        return "(none)"
    return "\n".join(f"- {item}" for item in items)


def _format_quotes(quotes: list) -> str:
    """Format quote list."""
    if not quotes:
        return "(none)"
    return "\n".join(f'- "{quote}"' for quote in quotes)
