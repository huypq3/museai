"""
Seed exhibit knowledge_base with embeddings into Firestore.
Run:
  cd backend
  python scripts/seed_knowledge_base.py
"""

import asyncio
import os
import sys
import inspect
from google.cloud import firestore

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from live.rag_context import add_embeddings_to_chunks


KNOWLEDGE_BASE = {
    "statue_tran_hung_dao": [
        {
            "chunk_id": "thd_001",
            "category": "biography",
            "content": (
                "Trần Hưng Đạo (1228-1300), tên thật Trần Quốc Tuấn, tước hiệu Hưng Đạo Đại Vương. "
                "Là Quốc công Tiết chế, tổng chỉ huy quân đội Đại Việt. 3 lần đánh bại quân Nguyên Mông "
                "vào các năm 1258, 1285, 1288. Được tôn vinh là một trong những nhà quân sự kiệt xuất."
            ),
        },
        {
            "chunk_id": "thd_002",
            "category": "statue_info",
            "content": (
                "Tượng Trần Hưng Đạo tại TP.HCM: cao 8.1 mét, nặng 7 tấn, chất liệu đồng đỏ. "
                "Tượng mô tả ông trong tư thế chỉ tay về phía trước, tượng trưng cho ý chí quyết chiến. "
                "Đặt tại công viên Mê Linh, quận 1."
            ),
        },
        {
            "chunk_id": "thd_003",
            "category": "battle",
            "content": (
                "Trận Bạch Đằng 1288: Trần Hưng Đạo cho đóng cọc nhọn dưới lòng sông, nhử thuyền chiến "
                "của Ô Mã Nhi vào khi thủy triều lên rồi phản công lúc triều xuống. "
                "Thủy quân Nguyên Mông thất bại nặng nề và Ô Mã Nhi bị bắt."
            ),
        },
        {
            "chunk_id": "thd_004",
            "category": "hich_tuong_si",
            "content": (
                "Hịch Tướng Sĩ (1285) là áng văn chính luận nổi tiếng, kêu gọi tướng sĩ đồng lòng "
                "chống xâm lược. Tác phẩm thể hiện tinh thần yêu nước và ý chí chiến đấu của thời Trần."
            ),
        },
        {
            "chunk_id": "thd_005",
            "category": "legacy",
            "content": (
                "Di sản của Trần Hưng Đạo được tôn vinh qua nhiều đền thờ trên cả nước, tiêu biểu là "
                "Đền Kiếp Bạc (Hải Dương). Ngày giỗ 20/8 âm lịch là lễ hội lớn, ông được nhân dân "
                "tôn kính với danh xưng Đức Thánh Trần."
            ),
        },
    ]
}


async def seed():
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT. Set it in environment before running seed.")

    exhibits_collection = os.getenv("EXHIBITS_COLLECTION", "exhibits")
    include_ids_raw = os.getenv("SEED_EXHIBIT_IDS", "").strip()
    include_ids = {x.strip() for x in include_ids_raw.split(",") if x.strip()}

    db = firestore.AsyncClient(project=project_id)

    for exhibit_id, chunks in KNOWLEDGE_BASE.items():
        if include_ids and exhibit_id not in include_ids:
            continue
        add_embeddings_to_chunks(chunks)
        exhibit_ref = db.collection(exhibits_collection).document(exhibit_id)
        payload = {"knowledge_base": chunks, "exhibit_id": exhibit_id}
        await exhibit_ref.set(payload, merge=True)
        print(f"✅ Seeded {len(chunks)} chunks for {exhibit_id}")

    close_result = db.close()
    if inspect.isawaitable(close_result):
        await close_result


if __name__ == "__main__":
    asyncio.run(seed())
