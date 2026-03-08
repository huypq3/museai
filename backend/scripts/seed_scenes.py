"""
Seed scene data into Firestore for exhibit Trần Hưng Đạo.
"""
import asyncio
import inspect
from google.cloud import firestore
import os

async def seed_scenes():
    """Add scenes data for exhibit statue_tran_hung_dao."""
    
    # Initialize Firestore
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT. Set it in environment before running seed.")
    db = firestore.AsyncClient(project=project_id)
    
    exhibit_id = os.getenv("SEED_EXHIBIT_ID", "statue_tran_hung_dao")
    exhibits_collection = os.getenv("EXHIBITS_COLLECTION", "exhibits")
    
    scenes = [
        {
            "keyword": "Trận Bạch Đằng",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Battle_of_Bach_Dang_River.jpg/800px-Battle_of_Bach_Dang_River.jpg",
            "trigger_words": ["bạch đằng", "thủy chiến", "cọc gỗ", "sông", "chiến thắng"]
        },
        {
            "keyword": "Quân Nguyên Mông",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Mongol_warrior.jpg/600px-Mongol_warrior.jpg",
            "trigger_words": ["nguyên mông", "xâm lược", "giặc", "1285", "1287", "mông cổ"]
        },
        {
            "keyword": "Trần Hưng Đạo chân dung",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Tran_Hung_Dao.jpg/400px-Tran_Hung_Dao.jpg",
            "trigger_words": ["hưng đạo", "đại vương", "tướng", "nhà trần", "anh hùng"]
        },
        {
            "keyword": "Hịch tướng sĩ",
            "image_url": "https://placehold.co/800x600/1a1000/C9A84C?text=Hich+Tuong+Si",
            "trigger_words": ["hịch", "tướng sĩ", "chiến đấu", "nghĩa sĩ", "lời kêu gọi"]
        },
        {
            "keyword": "Đền Kiếp Bạc",
            "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Kiep_Bac_temple.jpg/800px-Kiep_Bac_temple.jpg",
            "trigger_words": ["kiếp bạc", "đền", "thờ", "hải dương", "di tích"]
        },
    ]
    
    print(f"📝 Updating exhibit: {exhibit_id}")
    print(f"   Adding {len(scenes)} scenes...")
    
    try:
        # Update exhibit document.
        await db.collection(exhibits_collection).document(exhibit_id).set(
            {"scenes": scenes, "exhibit_id": exhibit_id}, merge=True
        )
        
        print(f"✅ Successfully added {len(scenes)} scenes to {exhibit_id}")
        
        # Verify
        doc = await db.collection(exhibits_collection).document(exhibit_id).get()
        if doc.exists:
            data = doc.to_dict()
            print(f"✅ Verified: document now has {len(data.get('scenes', []))} scenes")
            for i, scene in enumerate(data.get('scenes', []), 1):
                print(f"   {i}. {scene['keyword']} - {len(scene['trigger_words'])} triggers")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    
    finally:
        # google-cloud-firestore versions differ: close() can be sync or async.
        close_result = db.close()
        if inspect.isawaitable(close_result):
            await close_result

if __name__ == "__main__":
    print("🚀 Starting scene seeding...")
    asyncio.run(seed_scenes())
    print("✅ Done!")
