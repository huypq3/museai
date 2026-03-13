"""
Seed Firestore with demo data.
Creates/updates museum "vietnam_ethnology_museum" với exhibit trống đồng Đông Sơn.

Run:
  cd backend
  python scripts/seed_firestore.py
"""

import os
import sys
import asyncio
import inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import firestore


async def seed_firestore(project_id: str | None = None):
    """Seed demo data into Firestore."""

    resolved_project = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
    if not resolved_project:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT. Set env var or pass project_id explicitly.")

    print(f"🌱 Starting Firestore seed... (project={resolved_project})")

    db = firestore.AsyncClient(project=resolved_project)
    museums_collection = os.getenv("MUSEUMS_COLLECTION", "museums")
    exhibits_collection_name = os.getenv("EXHIBITS_COLLECTION", "exhibits")
    personas_collection_name = os.getenv("PERSONAS_COLLECTION", "personas")
    museum_id = os.getenv("SEED_MUSEUM_ID", "vietnam_ethnology_museum")

    # -------------------------------------------------------------------------
    # Museum document
    # -------------------------------------------------------------------------
    museum_data = {
        "id": museum_id,
        "name": "Bảo tàng Dân tộc học Việt Nam",
        "name_en": "Vietnam Museum of Ethnology",
        "slug": "vietnam-museum-of-ethnology",
        "address": "Đường Nguyễn Văn Huyên, phường Quan Hoa, quận Cầu Giấy",
        "city": "Hà Nội",
        "country": "Vietnam",
        "coordinates": {"lat": 21.0380, "lng": 105.7990},
        "phone": "+84-24-3756-2193",
        "email": "contact@vme.org.vn",
        "website": "https://www.vme.org.vn",
        "logo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Vietnam_Museum_of_Ethnology.jpg/400px-Vietnam_Museum_of_Ethnology.jpg",
        "cover_image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Vietnam_Museum_of_Ethnology.jpg/1200px-Vietnam_Museum_of_Ethnology.jpg",
        "opening_hours": {
            "monday": "Đóng cửa",
            "tuesday": "08:30-17:30",
            "wednesday": "08:30-17:30",
            "thursday": "08:30-17:30",
            "friday": "08:30-17:30",
            "saturday": "08:30-17:30",
            "sunday": "08:30-17:30",
        },
        "ticket_price": {
            "adult_vnd": 40000,
            "child_vnd": 20000,
            "foreign_adult_usd": 3,
            "free_for": "Trẻ em dưới 6 tuổi",
        },
        "supported_languages": ["vi", "en", "fr", "de", "ja", "ko", "zh"],
        "default_language": "vi",
        "ai_persona": "Hướng dẫn viên bảo tàng thân thiện, giàu kiến thức về lịch sử và văn hóa dân tộc học Việt Nam.",
        "welcome_message": {
            "vi": "Xin chào! Tôi là hướng dẫn viên AI của Bảo tàng Dân tộc học Việt Nam. Tôi rất vui được đưa bạn khám phá kho tàng văn hóa 54 dân tộc anh em.",
            "en": "Welcome to the Vietnam Museum of Ethnology! I am your AI guide, ready to explore the rich cultural heritage of Vietnam's 54 ethnic groups with you.",
            "fr": "Bienvenue au Musée d'Ethnologie du Vietnam! Je suis votre guide IA pour explorer les cultures des 54 groupes ethniques du Vietnam.",
            "de": "Willkommen im Vietnam Museum of Ethnology! Ich bin Ihr KI-Guide für die Erkundung der 54 Volksgruppen Vietnams.",
            "ja": "ベトナム民族学博物館へようこそ！ベトナムの54民族の豊かな文化遺産をご案内するAIガイドです。",
            "ko": "베트남 민족학 박물관에 오신 것을 환영합니다! 54개 민족의 풍부한 문화유산을 안내해 드릴 AI 가이드입니다.",
            "zh": "欢迎来到越南民族学博物馆！我是您的AI导览，将带您探索越南54个民族的丰富文化遗产。",
        },
        "status": "active",
        "exhibit_count": 0,
        "total_visits": 0,
        "museum_admin_uid": "",
        "created_by": "seed_script",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    museum_ref = db.collection(museums_collection).document(museum_id)
    await museum_ref.set(museum_data, merge=True)
    print(f"  ✅ Upserted museum: {museum_id}")

    # -------------------------------------------------------------------------
    # Exhibits
    # -------------------------------------------------------------------------
    exhibits_data = [
        {
            "id": "dong_son_drum",
            "data": {
                "name": "Trống đồng Đông Sơn",
                "name_en": "Dong Son Bronze Drum",
                "category": "other",
                "period": "Dong Son culture (7th century BCE - 6th century CE)",
                "type": "object",
                "era": "Thế kỷ 7 TCN – Thế kỷ 6 SCN, Văn hóa Đông Sơn",
                "description": {
                    "vi": (
                        "Trống đồng Đông Sơn (còn gọi là trống Heger loại I) là biểu tượng đỉnh cao của nền văn minh "
                        "người Việt cổ thời kỳ Hùng Vương dựng nước Văn Lang. Được đúc bằng hợp kim đồng-thiếc-chì "
                        "với kỹ thuật khuôn hai mảnh tinh xảo, trống có hình dáng cân đối hài hòa gồm bốn phần: mặt "
                        "trống, tang trống, thân trống và chân trống. Mặt trống trang trí ngôi sao nhiều cánh tượng trưng "
                        "cho Mặt Trời, bao quanh bởi các vành hoa văn mô tả sinh hoạt lễ hội, hình chim Lạc, thuyền chiến "
                        "và cảnh đua thuyền. Trống vừa là nhạc khí trong các nghi lễ tôn giáo, vừa là biểu tượng quyền lực "
                        "của thủ lĩnh và là vật tùy táng quý giá. Hiện Bảo tàng Lịch sử Quốc gia lưu giữ bộ sưu tập "
                        "trống đồng Đông Sơn lớn nhất thế giới, trong đó trống Ngọc Lũ được công nhận Bảo vật Quốc gia năm 2012."
                    ),
                    "en": (
                        "The Dong Son bronze drum (Heger type I) is a peak symbol of early Vietnamese civilization in "
                        "the Hung Kings era. Cast from a copper-tin-lead alloy with advanced two-piece mold techniques, "
                        "the drum has four main parts: drumhead, upper body, main body, and foot. Its center sunburst "
                        "motif is surrounded by decorative bands showing rituals, Lac birds, war boats, and boat races. "
                        "It functioned as a ritual instrument, a political symbol of authority, and a valuable burial object."
                    ),
                },
                "short_description": "Trống đồng hợp kim, biểu tượng văn minh Việt cổ, thế kỷ 7 TCN – 6 SCN",
                "location": {"hall": "Tòa Trống Đồng", "floor": 1, "position": "Khu trưng bày văn hóa Việt cổ"},
                "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/NgocLuDrum.jpg/800px-NgocLuDrum.jpg",
                "primary_image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/NgocLuDrum.jpg/800px-NgocLuDrum.jpg",
                "gallery_images": [
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/DongSonDrum-face.jpg/600px-DongSonDrum-face.jpg",
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Lac_bird_Dong_Son_drum.jpg/600px-Lac_bird_Dong_Son_drum.jpg",
                ],
                "visual_features": {
                    "description": (
                        "Trống đồng kích thước lớn, thân trống loe, mặt trống có ngôi sao nhiều cánh ở trung tâm, "
                        "hoa văn chim Lạc, cảnh lễ hội và thuyền."
                    ),
                    "distinctive_marks": [
                        "ngoi sao nhieu canh o mat trong",
                        "hoa van chim lac",
                        "than trong loe va day",
                        "hoa tiet dong tam",
                    ],
                },
                "persona_id": "dong_son_guide",
                "museum_id": museum_id,
                "status": "published",
                "total_scans": 0,
                "total_conversations": 0,
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        },
    ]

    # -------------------------------------------------------------------------
    # Personas
    # -------------------------------------------------------------------------
    personas_data = [
        {
            "id": "dong_son_guide",
            "data": {
                "subject_name": "Trống đồng Đông Sơn",
                "subject_role": "Chuyên gia văn hóa Đông Sơn và khảo cổ học Việt Nam cổ đại",
                "subject_era": "Văn hóa Đông Sơn, thế kỷ 7 TCN – thế kỷ 6 SCN",
                "storytelling_style": (
                    "Giàu cảm xúc, say mê và đầy tự hào dân tộc. Kết nối hiện vật với đời sống, "
                    "tín ngưỡng và bản sắc người Việt cổ. Giải thích kỹ thuật và biểu tượng một cách "
                    "sinh động, dễ hiểu cho mọi lứa tuổi."
                ),
                "opening_line": (
                    "Chào bạn! Trước mặt bạn là một trong những báu vật linh thiêng nhất của nền văn minh "
                    "Việt Nam cổ đại — trống đồng Đông Sơn, đã trải qua hơn 2.500 năm lịch sử và vẫn còn "
                    "ngân vang tiếng hồn thiêng sông núi đến tận hôm nay."
                ),
                "famous_quotes": [
                    "Trống đồng là quyển sách bằng đồng ghi lại toàn bộ văn hóa thời kỳ Đông Sơn cách đây 2.500 năm bằng hình ảnh. — TS. Nguyễn Văn Đoàn",
                    "Văn minh trống đồng xứng đáng sánh ngang văn minh kim tự tháp sông Nile. — Phạm Huy Thông",
                ],
                "key_events": [
                    "Văn hóa Đông Sơn hình thành từ thế kỷ 7 TCN trên đồng bằng sông Hồng",
                    "Trống đồng Ngọc Lũ được phát hiện năm 1893 tại Hà Nam",
                    "Học giả F. Heger (Áo) hệ thống phân loại trống đồng năm 1902",
                    "Trống Ngọc Lũ được công nhận Bảo vật Quốc gia năm 2012",
                    "Triển lãm 'Âm vang Đông Sơn' và phục dựng trống đồng năm 2023",
                ],
                "topics_to_emphasize": [
                    "Ý nghĩa biểu tượng của ngôi sao Mặt Trời và chim Lạc",
                    "Kỹ thuật đúc khuôn hai mảnh tinh xảo",
                    "Chức năng đa dạng: nhạc khí, biểu tượng quyền lực, lễ táng",
                    "Sự lan tỏa của văn hóa Đông Sơn ra toàn Đông Nam Á",
                    "Kết nối với thời đại Hùng Vương và nhà nước Văn Lang",
                ],
                "topics_to_avoid": [
                    "Tranh luận về nguồn gốc Trung Quốc hay Vân Nam chưa có kết luận chính thức",
                    "Giá trị thương mại của trống đồng hiện đại",
                    "So sánh tiêu cực với các nền văn minh khác",
                ],
            },
        },
    ]

    # Seed exhibits
    exhibits_collection = db.collection(exhibits_collection_name)
    for exhibit in exhibits_data:
        data = dict(exhibit["data"])
        data["exhibit_id"] = exhibit["id"]
        exhibit_ref = exhibits_collection.document(exhibit["id"])
        await exhibit_ref.set(data)
        print(f"  ✅ Created exhibit: {exhibit['id']}")

    # Seed personas
    personas_collection = db.collection(personas_collection_name)
    for persona in personas_data:
        doc_ref = personas_collection.document(persona["id"])
        await doc_ref.set(persona["data"])
        print(f"  ✅ Created persona: {persona['id']}")

    await museum_ref.set(
        {"exhibit_count": len(exhibits_data), "updated_at": firestore.SERVER_TIMESTAMP},
        merge=True,
    )

    print(f"\n🎉 Seeded {len(exhibits_data)} exhibits, {len(personas_data)} personas")
    print(f"   Museum ID : {museum_id}")
    print(f"   Museum    : Bảo tàng Dân tộc học Việt Nam")

    close_result = db.close()
    if inspect.isawaitable(close_result):
        await close_result


if __name__ == "__main__":
    asyncio.run(seed_firestore())
