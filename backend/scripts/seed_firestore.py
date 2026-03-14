"""
Seed Firestore with demo data.
Creates/updates museum "vietnam_ethnology_museum" với exhibit Tranh Đông Hồ Em Bé Ôm Cá Chép.

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
    # Museum document (merge — không ghi đè nếu đã tồn tại)
    # -------------------------------------------------------------------------
    museum_ref = db.collection(museums_collection).document(museum_id)
    museum_snap = await museum_ref.get()
    if not museum_snap.exists:
        museum_data = {
            "id": museum_id,
            "name": "Bảo tàng Dân tộc học Việt Nam",
            "name_en": "Vietnam Museum of Ethnology",
            "slug": "vietnam-museum-of-ethnology",
            "address": "Đường Nguyễn Văn Huyên, phường Quan Hoa, quận Cầu Giấy",
            "city": "Hà Nội",
            "country": "Vietnam",
            "coordinates": {"lat": 21.0380, "lng": 105.7990},
            "supported_languages": ["vi", "en", "fr", "de", "ja", "ko", "zh"],
            "default_language": "vi",
            "ai_persona": "Hướng dẫn viên bảo tàng thân thiện, giàu kiến thức về lịch sử và văn hóa dân tộc học Việt Nam.",
            "welcome_message": {
                "vi": "Xin chào! Tôi là hướng dẫn viên AI của Bảo tàng Dân tộc học Việt Nam. Tôi rất vui được đưa bạn khám phá kho tàng văn hóa 54 dân tộc anh em.",
                "en": "Welcome to the Vietnam Museum of Ethnology! I am your AI guide, ready to explore the rich cultural heritage of Vietnam's 54 ethnic groups with you.",
            },
            "status": "active",
            "exhibit_count": 0,
            "total_visits": 0,
            "created_by": "seed_script",
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
        await museum_ref.set(museum_data)
        print(f"  ✅ Created museum: {museum_id}")
    else:
        print(f"  ℹ️  Museum already exists, skipping: {museum_id}")

    # -------------------------------------------------------------------------
    # Exhibits
    # -------------------------------------------------------------------------
    exhibits_data = [
        {
            "id": "dong_ho_baby_fish",
            "data": {
                "name": "Tranh Đông Hồ — Em Bé Ôm Cá Chép",
                "name_en": "Dong Ho Folk Painting — Baby Holding Carp",
                "category": "painting",
                "period": "Tranh dân gian, khoảng thế kỷ XVI – nay, làng Đông Hồ, Bắc Ninh",
                "type": "object",
                "era": "Khoảng thế kỷ XVI – hiện đại, dòng tranh khắc gỗ dân gian Việt Nam",
                "description": {
                    "vi": (
                        "Tranh Đông Hồ 'Em Bé Ôm Cá Chép' là một trong những bức tranh chúc tụng tiêu biểu nhất "
                        "của dòng tranh dân gian làng Đông Hồ (xã Song Hồ, huyện Thuận Thành, tỉnh Bắc Ninh). "
                        "Bức tranh mô tả hình ảnh một bé gái mũm mĩm, bụ bẫm đang ôm chặt một con cá chép to và "
                        "nặng, nét mặt tươi vui rạng rỡ. Cá chép trong văn hóa dân gian Việt Nam tượng trưng cho "
                        "phú quý sung túc, học hành thăng tiến và tinh thần kiên cường vượt khó — xuất phát từ "
                        "truyền thuyết 'Cá chép hóa rồng' khi vượt qua vũ môn. Bức tranh mang lời nguyện ước của "
                        "ông cha: cầu cho con cái học giỏi, cuộc đời sung túc và ý chí mạnh mẽ vượt qua mọi "
                        "sóng gió. Tranh được in thủ công bằng khuôn khắc gỗ trên giấy dó phủ điệp — loại giấy "
                        "đặc trưng làm từ vỏ sò điệp nghiền nhuyễn, tạo ánh lấp lánh tự nhiên. Màu sắc hoàn toàn "
                        "từ thiên nhiên: đỏ từ sỏi son, vàng từ hoa dành dành, xanh từ gỉ đồng hoặc lá chàm, "
                        "đen từ than lá tre. Năm 2012, nghề làm tranh dân gian Đông Hồ được đưa vào Danh mục Di "
                        "sản văn hóa phi vật thể quốc gia, và Bộ Văn hóa đang lập hồ sơ trình UNESCO."
                    ),
                    "en": (
                        "The Dong Ho folk painting 'Baby Holding Carp' is one of the most iconic congratulatory "
                        "paintings from Dong Ho village (Song Ho commune, Thuan Thanh district, Bac Ninh province). "
                        "It depicts a chubby, cheerful baby girl hugging a large carp tightly. In Vietnamese folk "
                        "culture, the carp symbolizes prosperity, academic success and perseverance — rooted in the "
                        "legend of the carp leaping the Dragon Gate to transform into a dragon. The painting carries "
                        "the ancestral wish for children to study well, live prosperously, and overcome life's "
                        "hardships with courage. It is hand-printed using carved wooden blocks on 'giay diep' paper "
                        "— traditional do paper coated with crushed mollusk shells that creates a natural shimmer. "
                        "All pigments are plant- and mineral-based: red from ochre, yellow from gardenia flowers, "
                        "blue-green from copper rust or indigo leaves, black from bamboo-leaf charcoal."
                    ),
                },
                "short_description": "Tranh khắc gỗ dân gian, bé gái ôm cá chép — cầu chúc phú quý học hành thăng tiến",
                "location": {"hall": "Nhà Việt Nam", "floor": 1, "position": "Khu trưng bày nghệ thuật dân gian"},
                "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Dong_Ho_painting_-_baby_with_fish.jpg/800px-Dong_Ho_painting_-_baby_with_fish.jpg",
                "primary_image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Dong_Ho_painting_-_baby_with_fish.jpg/800px-Dong_Ho_painting_-_baby_with_fish.jpg",
                "gallery_images": [
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/DongHoPainting.jpg/800px-DongHoPainting.jpg",
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Dong_Ho_woodblock_print.jpg/600px-Dong_Ho_woodblock_print.jpg",
                ],
                "visual_features": {
                    "description": (
                        "Bức tranh nền giấy điệp trắng ngà lấp lánh, hình em bé gái mũm mĩm ôm cá chép to, "
                        "màu sắc tươi sáng đỏ-vàng-xanh-đen từ nguyên liệu tự nhiên, nét khắc gỗ đậm đà."
                    ),
                    "distinctive_marks": [
                        "em be gai mum mim om ca chep",
                        "nen giay diep trang nga lap lanh",
                        "mau do vang xanh tu thien nhien",
                        "net khac go dam da thu cong",
                        "ca chep to duoi xoe vay lon",
                    ],
                },
                "persona_id": "dong_ho_fish_guide",
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
            "id": "dong_ho_fish_guide",
            "data": {
                "subject_name": "Tranh Đông Hồ Em Bé Ôm Cá Chép",
                "subject_role": "Chuyên gia nghệ thuật tranh dân gian Đông Hồ và văn hóa dân gian Việt Nam",
                "subject_era": "Dòng tranh dân gian làng Đông Hồ, khoảng thế kỷ XVI đến nay",
                "storytelling_style": (
                    "Ấm áp, gần gũi và đầy tình cảm dân gian. Kết nối hình ảnh tranh với ước mơ bình dị "
                    "của người nông dân Việt về học hành, sung túc và hạnh phúc gia đình. Giải thích ký hiệu "
                    "và biểu tượng một cách tự nhiên, sinh động, phù hợp với mọi lứa tuổi. Trân trọng vẻ đẹp "
                    "mộc mạc và sự tinh tế trong từng nét khắc thủ công."
                ),
                "opening_line": (
                    "Chào bạn! Bức tranh trước mặt bạn là một trong những lời chúc tụng đẹp nhất mà "
                    "ông cha người Việt dành cho con cháu — em bé ôm cá chép, mang theo ước vọng về "
                    "học hành thăng tiến, cuộc sống phú quý và tinh thần kiên cường không bao giờ bỏ cuộc."
                ),
                "famous_quotes": [
                    "Tranh Đông Hồ gà lợn nét tươi trong / Màu dân tộc sáng bừng trên giấy điệp. — Hoàng Cầm",
                    "Tranh Đông Hồ đã sử dụng chính cái hồn của cuộc sống để vẽ tranh và phác họa tinh thần dân tộc.",
                ],
                "key_events": [
                    "Làng tranh Đông Hồ hình thành và phát triển từ khoảng thế kỷ XVI tại xã Song Hồ, Thuận Thành, Bắc Ninh",
                    "Tranh Đông Hồ trở thành dòng tranh dân gian phổ biến nhất Việt Nam, bán rộng rãi dịp Tết Nguyên Đán",
                    "Nhà thơ Tú Xương nhắc đến tranh Đông Hồ trong thơ cuối thế kỷ XIX",
                    "Nhà thơ Hoàng Cầm ca ngợi tranh Đông Hồ trong bài thơ 'Bên kia sông Đuống' (1948)",
                    "Năm 2012, nghề làm tranh dân gian Đông Hồ được công nhận Di sản văn hóa phi vật thể quốc gia",
                    "Bộ Văn hóa lập hồ sơ trình UNESCO đề nghị công nhận Di sản văn hóa phi vật thể",
                ],
                "topics_to_emphasize": [
                    "Ý nghĩa biểu tượng cá chép: phú quý, học hành, 'cá chép hóa rồng'",
                    "Hình ảnh em bé mũm mĩm: tính phồn thực, ước mơ con cháu khỏe mạnh thành đạt",
                    "Kỹ thuật in khắc gỗ thủ công và giấy điệp óng ánh độc đáo",
                    "Màu sắc hoàn toàn từ thiên nhiên: sỏi son, hoa dành dành, gỉ đồng, than lá tre",
                    "Dòng tranh chúc tụng: bộ tứ Lễ Trí — Nhân Nghĩa — Vinh Hoa — Phú Quý",
                    "Lời nguyện ước dân gian gửi gắm qua từng đường nét khắc gỗ",
                ],
                "topics_to_avoid": [
                    "So sánh tiêu cực với tranh dân gian của các quốc gia khác",
                    "Giá trị thương mại hay mua bán tranh Đông Hồ hiện đại",
                    "Tranh giả, tranh in công nghiệp không phải từ làng Đông Hồ chính gốc",
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
        {"updated_at": firestore.SERVER_TIMESTAMP},
        merge=True,
    )

    print(f"\n🎉 Seeded {len(exhibits_data)} exhibits, {len(personas_data)} personas")
    print(f"   Museum ID  : {museum_id}")
    print(f"   Exhibit ID : dong_ho_baby_fish")
    print(f"   Persona ID : dong_ho_fish_guide")

    close_result = db.close()
    if inspect.isawaitable(close_result):
        await close_result


if __name__ == "__main__":
    asyncio.run(seed_firestore())
