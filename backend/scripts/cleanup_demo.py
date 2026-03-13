"""
Xoá toàn bộ dữ liệu demo khỏi Firestore.

Xoá các document sau:
  museums/demo_museum
  museums/vietnam_ethnology_museum
  exhibits/statue_tran_hung_dao
  exhibits/pottery_ly
  exhibits/painting_dongho
  exhibits/dong_son_drum
  personas/tran_hung_dao
  personas/pottery_guide
  personas/art_guide
  personas/dong_son_guide

Thêm ID tùy chỉnh qua env var:
  EXTRA_MUSEUM_IDS="id1,id2"
  EXTRA_EXHIBIT_IDS="id1,id2"
  EXTRA_PERSONA_IDS="id1,id2"

Chạy:
  cd backend
  python scripts/cleanup_demo.py

Chạy thực sự (không chỉ dry-run):
  DRY_RUN=false python scripts/cleanup_demo.py
"""

import asyncio
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google.cloud import firestore

# ---------------------------------------------------------------------------
# Danh sách demo IDs mặc định
# ---------------------------------------------------------------------------

DEFAULT_MUSEUM_IDS = [
    # demo/test cũ
    "demo_museum",
    "vietnam_ethnology_museum",
    # test documents thực tế trên Firestore
    "airforce_muse",
    "test-museum-a-1772693352",
    "test-museum-b-1772693352",
    "testmuseuma1772693403",
    "testmuseuma1772693481",
    "testmuseumb1772693403",
    "testmuseumb1772693481",
]

DEFAULT_EXHIBIT_IDS = [
    # demo cũ
    "statue_tran_hung_dao",
    "pottery_ly",
    "painting_dongho",
    "dong_son_drum",
    # test documents thực tế trên Firestore
    "retest_artifact_1772693524",
    "test_artifact_1772693403",
    "test_artifact_1772693481",
]

DEFAULT_PERSONA_IDS = [
    "tran_hung_dao",
    "pottery_guide",
    "art_guide",
    "dong_son_guide",
]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def delete_doc(collection_ref, doc_id: str, dry_run: bool) -> bool:
    """Xoá 1 document. Trả về True nếu document tồn tại."""
    doc_ref = collection_ref.document(doc_id)
    doc = await doc_ref.get()
    if not doc.exists:
        print(f"  ⚪ Không tồn tại: {collection_ref.id}/{doc_id}")
        return False
    if dry_run:
        print(f"  🔍 [DRY-RUN] Sẽ xoá: {collection_ref.id}/{doc_id}")
    else:
        await doc_ref.delete()
        print(f"  🗑️  Đã xoá:    {collection_ref.id}/{doc_id}")
    return True


def parse_extra(env_key: str) -> list[str]:
    raw = os.getenv(env_key, "").strip()
    return [x.strip() for x in raw.split(",") if x.strip()]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def cleanup():
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError(
            "Missing GOOGLE_CLOUD_PROJECT. Set env var before running cleanup."
        )

    dry_run_env = os.getenv("DRY_RUN", "true").lower()
    dry_run = dry_run_env not in ("false", "0", "no")

    museums_col    = os.getenv("MUSEUMS_COLLECTION",  "museums")
    exhibits_col   = os.getenv("EXHIBITS_COLLECTION", "exhibits")
    personas_col   = os.getenv("PERSONAS_COLLECTION", "personas")

    museum_ids  = DEFAULT_MUSEUM_IDS  + parse_extra("EXTRA_MUSEUM_IDS")
    exhibit_ids = DEFAULT_EXHIBIT_IDS + parse_extra("EXTRA_EXHIBIT_IDS")
    persona_ids = DEFAULT_PERSONA_IDS + parse_extra("EXTRA_PERSONA_IDS")

    print("=" * 60)
    print("🧹 MuseAI — Cleanup Demo Data")
    print("=" * 60)
    print(f"  Project  : {project_id}")
    print(f"  Mode     : {'DRY-RUN (không xoá thật)' if dry_run else '⚠️  THỰC SỰ XOÁ DỮ LIỆU'}")
    print()

    if not dry_run:
        print("  ⚠️  Bạn sắp xoá vĩnh viễn dữ liệu demo!")
        confirm = input("  Nhập 'yes' để xác nhận: ").strip().lower()
        if confirm != "yes":
            print("  ❌ Huỷ bỏ.")
            return
        print()

    db = firestore.AsyncClient(project=project_id)

    museums_ref  = db.collection(museums_col)
    exhibits_ref = db.collection(exhibits_col)
    personas_ref = db.collection(personas_col)

    total_deleted = 0
    total_missing = 0

    # --- Museums ---
    print(f"📁 Collection: {museums_col}")
    for mid in museum_ids:
        existed = await delete_doc(museums_ref, mid, dry_run)
        if existed:
            total_deleted += 1
        else:
            total_missing += 1

    print()

    # --- Exhibits ---
    print(f"📁 Collection: {exhibits_col}")
    for eid in exhibit_ids:
        existed = await delete_doc(exhibits_ref, eid, dry_run)
        if existed:
            total_deleted += 1
        else:
            total_missing += 1

    print()

    # --- Personas ---
    print(f"📁 Collection: {personas_col}")
    for pid in persona_ids:
        existed = await delete_doc(personas_ref, pid, dry_run)
        if existed:
            total_deleted += 1
        else:
            total_missing += 1

    print()
    print("=" * 60)
    if dry_run:
        print(f"✅ DRY-RUN hoàn tất: {total_deleted} document sẽ bị xoá, {total_missing} không tồn tại.")
        print("   Chạy lại với DRY_RUN=false để xoá thật.")
    else:
        print(f"✅ Cleanup hoàn tất: đã xoá {total_deleted} document, {total_missing} không tồn tại.")
    print("=" * 60)

    close_result = db.close()
    if inspect.isawaitable(close_result):
        await close_result


if __name__ == "__main__":
    asyncio.run(cleanup())
