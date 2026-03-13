"""
Seed scene data vào Firestore cho exhibit Trống đồng Đông Sơn.
Museum: Bảo tàng Dân tộc học Việt Nam

Run:
  cd backend
  python scripts/seed_scenes.py
"""

import asyncio
import inspect
import os
from google.cloud import firestore


async def seed_scenes():
    """Add scenes data for exhibit dong_son_drum."""

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT. Set it in environment before running seed.")

    db = firestore.AsyncClient(project=project_id)

    exhibit_id = os.getenv("SEED_EXHIBIT_ID", "dong_son_drum")
    exhibits_collection = os.getenv("EXHIBITS_COLLECTION", "exhibits")

    scenes = [
        {
            "keyword": "Trống đồng Ngọc Lũ",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/NgocLuDrum.jpg/800px-NgocLuDrum.jpg",
            "trigger_words": [
                "ngọc lũ", "trống lớn", "bảo vật", "đẹp nhất", "tiêu biểu",
                "79", "86 kg", "14 cánh", "hà nam", "1893",
            ],
        },
        {
            "keyword": "Hoa văn mặt trống đồng — ngôi sao mặt trời",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/DongSonDrum-face.jpg/600px-DongSonDrum-face.jpg",
            "trigger_words": [
                "mặt trống", "ngôi sao", "mặt trời", "hoa văn", "cánh sao",
                "trung tâm", "vành", "tia", "lông công", "đồng tâm",
            ],
        },
        {
            "keyword": "Chim Lạc trên trống đồng Đông Sơn",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Lac_bird_Dong_Son_drum.jpg/600px-Lac_bird_Dong_Son_drum.jpg",
            "trigger_words": [
                "chim lạc", "chim hồng", "vật tổ", "lạc việt", "18 con",
                "chim bay", "chim đậu", "hình chim",
            ],
        },
        {
            "keyword": "Cảnh lễ hội và sinh hoạt trên trống đồng",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Dong_Son_bronze_drum_decorations.jpg/800px-Dong_Son_bronze_drum_decorations.jpg",
            "trigger_words": [
                "nhảy múa", "lễ hội", "giã gạo", "đánh trống", "đua thuyền",
                "hình người", "lông chim", "nhà sàn", "hươu", "cảnh sinh hoạt",
            ],
        },
        {
            "keyword": "Thuyền chiến trên thân trống đồng",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/DongSonBoat.jpg/800px-DongSonBoat.jpg",
            "trigger_words": [
                "thuyền", "thuyền chiến", "mái chèo", "chiến binh", "sông nước",
                "tang trống", "thân trống", "đua thuyền", "lính",
            ],
        },
        {
            "keyword": "Bản đồ phân bố văn hóa Đông Sơn",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Dong_Son_culture_map.png/800px-Dong_Son_culture_map.png",
            "trigger_words": [
                "đông nam á", "lan rộng", "indonesia", "thái lan", "lào",
                "trung quốc", "phân bố", "vùng", "khu vực", "ảnh hưởng",
            ],
        },
        {
            "keyword": "Kỹ thuật đúc đồng Đông Sơn — khuôn đúc",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/DongSonMold.jpg/600px-DongSonMold.jpg",
            "trigger_words": [
                "khuôn đúc", "kỹ thuật", "đúc đồng", "luyện kim", "hợp kim",
                "đồng thiếc", "khuôn hai mảnh", "con kê", "luy lâu", "phục dựng",
            ],
        },
        {
            "keyword": "Bảo tàng Dân tộc học Việt Nam — Tòa Trống Đồng",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Vietnam_Museum_of_Ethnology.jpg/800px-Vietnam_Museum_of_Ethnology.jpg",
            "trigger_words": [
                "bảo tàng", "dân tộc học", "tòa trống đồng", "cầu giấy",
                "nguyễn văn huyên", "trưng bày", "54 dân tộc", "hà nội",
            ],
        },
    ]

    print(f"📝 Updating exhibit: {exhibit_id}")
    print(f"   Adding {len(scenes)} scenes...")

    try:
        await db.collection(exhibits_collection).document(exhibit_id).set(
            {"scenes": scenes, "exhibit_id": exhibit_id}, merge=True
        )
        print(f"✅ Successfully added {len(scenes)} scenes to {exhibit_id}")

        # Verify
        doc = await db.collection(exhibits_collection).document(exhibit_id).get()
        if doc.exists:
            data = doc.to_dict()
            print(f"✅ Verified: document now has {len(data.get('scenes', []))} scenes")
            for i, scene in enumerate(data.get("scenes", []), 1):
                print(f"   {i}. {scene['keyword']} — {len(scene['trigger_words'])} triggers")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise

    finally:
        close_result = db.close()
        if inspect.isawaitable(close_result):
            await close_result


if __name__ == "__main__":
    print("🚀 Starting scene seeding...")
    asyncio.run(seed_scenes())
    print("✅ Done!")
