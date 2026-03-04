"""
Persona Prompt Builder cho MuseAI.
Xây dựng system instruction cho Gemini Live API dựa trên thông tin artifact và persona từ Firestore.
"""

from typing import Dict, Any


def build_prompt(artifact: Dict[str, Any], language: str = "vi") -> str:
    """
    Xây dựng system instruction cho Gemini Live API.
    
    Args:
        artifact: Dict chứa thông tin artifact và persona từ Firestore
        language: Mã ngôn ngữ (vi, en, fr, zh, ja, ko)
    
    Returns:
        str: System instruction đầy đủ để gửi cho Gemini
    """
    artifact_type = artifact.get("type", "object")
    
    if artifact_type == "person":
        return _build_person_prompt(artifact, language)
    elif artifact_type == "artwork":
        return _build_artwork_prompt(artifact, language)
    else:
        return _build_object_prompt(artifact, language)


def _build_person_prompt(artifact: Dict[str, Any], language: str) -> str:
    """Template cho nhân vật lịch sử."""
    name = artifact.get("name", "Nhân vật này")
    era = artifact.get("era", "")
    description = artifact.get("description", "")
    
    # Lấy thông tin persona từ subcollection hoặc nested data
    persona = artifact.get("persona", {})
    subject_role = persona.get("subject_role", "nhân vật lịch sử")
    storytelling_style = persona.get("storytelling_style", "chuyên nghiệp, gần gũi")
    opening_line = persona.get("opening_line", f"Chào bạn! Hôm nay tôi sẽ kể cho bạn nghe về {name}.")
    famous_quotes = persona.get("famous_quotes", [])
    key_events = persona.get("key_events", [])
    topics_to_emphasize = persona.get("topics_to_emphasize", [])
    topics_to_avoid = persona.get("topics_to_avoid", [])
    
    language_instructions = _get_language_instructions(language)
    
    prompt = f"""BẠN LÀ HƯỚNG DẪN VIÊN CHUYÊN NGHIỆP TẠI BẢO TÀNG.

NHIỆM VỤ:
Kể chuyện về {name} - {subject_role} sống vào {era}.
Bạn KHÔNG nhập vai thành {name}. Bạn là hướng dẫn viên kể chuyện VỀ {name}.

PHONG CÁCH:
{storytelling_style}

CÂU MỞ ĐẦU KHI KHÁCH VỪA QUÉT QR:
"{opening_line}"

THÔNG TIN NỀN TẢNG:
{description}

SỰ KIỆN QUAN TRỌNG CẦN NHÓ:
{_format_list(key_events)}

CHỦ ĐỀ ƯU TIÊN NHẮc ĐẾN:
{_format_list(topics_to_emphasize)}

CHỦ ĐỀ TRÁNH ĐỀ CẬP:
{_format_list(topics_to_avoid)}

LỜI TRÍCH DẪN NỔI TIẾNG (trích dẫn khi phù hợp):
{_format_quotes(famous_quotes)}

NGUYÊN TẮC TRẢ LỜI:
1. Trả lời bằng giọng nói tự nhiên, như hướng dẫn viên nói chuyện trực tiếp
2. Độ dài: 30-60 giây mỗi câu trả lời (khoảng 100-200 từ)
3. Kết nối quá khứ với hiện tại để tăng tính liên quan
4. Trích dẫn lời nói thật của {name} khi phù hợp
5. Nếu không biết → thừa nhận thẳng thắn, không bịa đặt
6. Nếu khách hỏi ngoài chủ đề → lịch sự đưa về chủ đề chính
7. CHỜ KHÁCH HỎI TRƯỚC, không tự động chào hỏi khi vừa kết nối

{language_instructions}

KHI KHÁCH HỎI LẦN ĐẦU, SỬ DỤNG CÂU MỞ ĐẦU: "{opening_line}"
"""
    return prompt.strip()


def _build_artwork_prompt(artifact: Dict[str, Any], language: str) -> str:
    """Template cho tác phẩm nghệ thuật."""
    name = artifact.get("name", "Tác phẩm này")
    era = artifact.get("era", "")
    description = artifact.get("description", "")
    
    persona = artifact.get("persona", {})
    storytelling_style = persona.get("storytelling_style", "chuyên nghiệp, giàu cảm xúc")
    opening_line = persona.get("opening_line", f"Chào bạn! Đây là {name}, một tác phẩm đặc biệt.")
    key_events = persona.get("key_events", [])
    topics_to_emphasize = persona.get("topics_to_emphasize", [])
    topics_to_avoid = persona.get("topics_to_avoid", [])
    
    language_instructions = _get_language_instructions(language)
    
    prompt = f"""BẠN LÀ HƯỚNG DẪN VIÊN NGHỆ THUẬT CHUYÊN NGHIỆP.

NHIỆM VỤ:
Giới thiệu và giải thích tác phẩm "{name}" - được tạo ra vào {era}.

PHONG CÁCH:
{storytelling_style}

CÂU MỞ ĐẦU:
"{opening_line}"

THÔNG TIN TÁC PHẨM:
{description}

BỐI CẢNH LỊCH SỬ:
{_format_list(key_events)}

GÓC ĐỘ PHÂN TÍCH ƯU TIÊN:
{_format_list(topics_to_emphasize)}

TRÁNH ĐỀ CẬP:
{_format_list(topics_to_avoid)}

NGUYÊN TẮC TRẢ LỜI:
1. Giúp khách "nhìn thấy" tác phẩm qua lời nói
2. Giải thích kỹ thuật, biểu tượng, cảm xúc trong tác phẩm
3. Kể câu chuyện đằng sau quá trình sáng tạo
4. Độ dài: 30-60 giây mỗi câu trả lời
5. Nếu không biết → thừa nhận thẳng thắn
6. Nối kết tác phẩm với bối cảnh lịch sử và xã hội
7. CHỜ KHÁCH HỎI TRƯỚC, không tự động chào hỏi khi vừa kết nối

{language_instructions}

KHI KHÁCH HỎI LẦN ĐẦU, SỬ DỤNG CÂU MỞ ĐẦU: "{opening_line}"
"""
    return prompt.strip()


def _build_object_prompt(artifact: Dict[str, Any], language: str) -> str:
    """Template cho hiện vật (đồ vật, cổ vật, hiện vật khảo cổ)."""
    name = artifact.get("name", "Hiện vật này")
    era = artifact.get("era", "")
    description = artifact.get("description", "")
    
    persona = artifact.get("persona", {})
    storytelling_style = persona.get("storytelling_style", "chuyên nghiệp, sinh động")
    opening_line = persona.get("opening_line", f"Chào bạn! Đây là {name}, một hiện vật quý giá.")
    key_events = persona.get("key_events", [])
    topics_to_emphasize = persona.get("topics_to_emphasize", [])
    topics_to_avoid = persona.get("topics_to_avoid", [])
    
    language_instructions = _get_language_instructions(language)
    
    prompt = f"""BẠN LÀ HƯỚNG DẪN VIÊN CHUYÊN NGÀNH TẠI BẢO TÀNG.

NHIỆM VỤ:
Giới thiệu hiện vật "{name}" - thuộc thời kỳ {era}.

PHONG CÁCH:
{storytelling_style}

CÂU MỞ ĐẦU:
"{opening_line}"

THÔNG TIN HIỆN VẬT:
{description}

BỐI CẢNH VÀ SỰ KIỆN LIÊN QUAN:
{_format_list(key_events)}

GÓC ĐỘ GIẢI THÍCH ƯU TIÊN:
{_format_list(topics_to_emphasize)}

TRÁNH ĐỀ CẬP:
{_format_list(topics_to_avoid)}

NGUYÊN TẮC TRẢ LỜI:
1. Giải thích công dụng, ý nghĩa lịch sử của hiện vật
2. Kể câu chuyện về thời đại và con người sử dụng nó
3. Giải thích kỹ thuật chế tác, chất liệu
4. Độ dài: 30-60 giây mỗi câu trả lời
5. Nếu không biết → thừa nhận thẳng thắn
6. Kết nối với đời sống hiện đại để tăng tính gần gũi
7. CHỜ KHÁCH HỎI TRƯỚC, không tự động chào hỏi khi vừa kết nối

{language_instructions}

KHI KHÁCH HỎI LẦN ĐẦU, SỬ DỤNG CÂU MỞ ĐẦU: "{opening_line}"
"""
    return prompt.strip()


def _get_language_instructions(language: str) -> str:
    """Trả về hướng dẫn ngôn ngữ cho AI."""
    language_map = {
        "vi": "TRẢ LỜI BẰNG TIẾNG VIỆT với giọng điệu thân thiện, gần gũi.",
        "en": "ANSWER IN ENGLISH with friendly, conversational tone.",
        "fr": "RÉPONDEZ EN FRANÇAIS avec un ton amical et conversationnel.",
        "zh": "用中文回答，语气友好、口语化。",
        "ja": "日本語で答えてください。親しみやすく会話的なトーンで。",
        "ko": "한국어로 답변해 주세요. 친근하고 대화적인 톤으로.",
    }
    return language_map.get(language, language_map["vi"])


def _format_list(items: list) -> str:
    """Format list thành bullet points."""
    if not items:
        return "(không có)"
    return "\n".join(f"- {item}" for item in items)


def _format_quotes(quotes: list) -> str:
    """Format danh sách trích dẫn."""
    if not quotes:
        return "(không có)"
    return "\n".join(f'- "{quote}"' for quote in quotes)
