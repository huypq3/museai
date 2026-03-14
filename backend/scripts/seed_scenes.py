"""
Seed scene data vào Firestore cho exhibit Tranh Đông Hồ Em Bé Ôm Cá Chép.
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
    """Add scenes data for exhibit dong_ho_baby_fish."""

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT. Set it in environment before running seed.")

    db = firestore.AsyncClient(project=project_id)

    exhibit_id = os.getenv("SEED_EXHIBIT_ID", "dong_ho_baby_fish")
    exhibits_collection = os.getenv("EXHIBITS_COLLECTION", "exhibits")

    scenes = [
        {
            "keyword": "Tranh Đông Hồ Em Bé Ôm Cá Chép — toàn cảnh",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Dong_Ho_painting_-_baby_with_fish.jpg/800px-Dong_Ho_painting_-_baby_with_fish.jpg",
            "trigger_words": [
                "em bé ôm cá", "bé gái ôm cá", "tranh đông hồ cá chép",
                "toàn cảnh", "bức tranh", "em bé", "bụ bẫm", "mũm mĩm",
                "niềm vui", "tươi vui", "đáng yêu", "ôm chặt",
            ],
        },
        {
            "keyword": "Cá chép trong tranh dân gian — biểu tượng phú quý",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Koi_fish_Dong_Son_art.jpg/800px-Koi_fish_Dong_Son_art.jpg",
            "trigger_words": [
                "cá chép", "phú quý", "sung túc", "dư giả", "giàu sang",
                "cá vượt vũ môn", "cá hóa rồng", "vảy cá", "đuôi cá",
                "cá to", "cá nặng",
            ],
        },
        {
            "keyword": "Giấy điệp — chất liệu đặc trưng tranh Đông Hồ",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/DongHoPainting.jpg/800px-DongHoPainting.jpg",
            "trigger_words": [
                "giấy điệp", "giấy dó", "lấp lánh", "óng ánh", "trắng ngà",
                "vỏ điệp", "vỏ sò", "chổi lá thông", "nền giấy", "ánh sáng",
                "chất liệu", "nguyên liệu",
            ],
        },
        {
            "keyword": "Ván khắc gỗ in tranh Đông Hồ",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Dong_Ho_woodblock_print.jpg/600px-Dong_Ho_woodblock_print.jpg",
            "trigger_words": [
                "ván khắc", "khắc gỗ", "in tranh", "khuôn in", "bản khắc",
                "gỗ thị", "gỗ mỡ", "thủ công", "kỹ thuật in", "nghệ nhân",
                "khắc", "đục", "bộ ve",
            ],
        },
        {
            "keyword": "Màu sắc tự nhiên trong tranh Đông Hồ — sỏi son, hoa dành dành",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Dong_Ho_natural_colors.jpg/800px-Dong_Ho_natural_colors.jpg",
            "trigger_words": [
                "màu tự nhiên", "sỏi son", "hoa dành dành", "lá chàm", "gỉ đồng",
                "than lá tre", "màu đỏ", "màu vàng", "màu xanh", "màu đen",
                "thiên nhiên", "không hóa chất", "màu sắc",
            ],
        },
        {
            "keyword": "Làng tranh dân gian Đông Hồ — Thuận Thành, Bắc Ninh",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Dong_Ho_village_Bac_Ninh.jpg/800px-Dong_Ho_village_Bac_Ninh.jpg",
            "trigger_words": [
                "làng đông hồ", "thuận thành", "bắc ninh", "song hồ", "làng mái",
                "làng nghề", "sông đuống", "lịch sử", "thế kỷ xvi", "truyền thống",
                "bán tranh", "tết xưa",
            ],
        },
        {
            "keyword": "Bộ tứ tranh chúc tụng Đông Hồ — Lễ Trí Nhân Nghĩa Vinh Hoa Phú Quý",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Dong_Ho_four_blessings.jpg/800px-Dong_Ho_four_blessings.jpg",
            "trigger_words": [
                "lễ trí", "nhân nghĩa", "vinh hoa", "phú quý", "bộ tứ",
                "em bé ôm rùa", "em bé ôm cóc", "em bé ôm gà", "em bé ôm vịt",
                "tranh chúc tụng", "bộ tranh", "tết",
            ],
        },
        {
            "keyword": "Bảo tàng Dân tộc học Việt Nam — khu trưng bày tranh dân gian",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Vietnam_Museum_of_Ethnology.jpg/800px-Vietnam_Museum_of_Ethnology.jpg",
            "trigger_words": [
                "bảo tàng", "dân tộc học", "cầu giấy", "nguyễn văn huyên",
                "trưng bày", "54 dân tộc", "hà nội", "nhà việt nam",
                "khu dân gian", "tầng 1",
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
