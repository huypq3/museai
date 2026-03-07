"""
Firestore migration: artifacts -> exhibits (backward compatible).

What this script does:
1) Copy `artifacts` collection to `exhibits` (same doc IDs).
2) Copy `artifact_chunks` to `exhibit_chunks`, add `exhibit_id`.
3) Update selected collections to add `exhibit_id` while keeping `artifact_id`.
4) Normalize QR URLs from `artifact=` to `exhibit=` for new flow.

Run:
  cd backend
  python scripts/migrate_artifacts_to_exhibits.py
"""

from __future__ import annotations

import os
import asyncio
from typing import Any
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

from google.cloud import firestore


PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026")
db = firestore.AsyncClient(project=PROJECT_ID)


def _rewrite_qr_url(url: str) -> str:
    if not url:
        return url
    try:
        parsed = urlparse(url)
        q = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if "artifact" in q and "exhibit" not in q:
            q["exhibit"] = q["artifact"]
        new_query = urlencode(q)
        return urlunparse(parsed._replace(query=new_query))
    except Exception:
        return url


async def migrate_collection_artifacts_to_exhibits() -> None:
    count = 0
    async for doc in db.collection("artifacts").stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        data.setdefault("exhibit_id", doc.id)
        if "qr_url" in data and isinstance(data["qr_url"], str):
            data["qr_url"] = _rewrite_qr_url(data["qr_url"])
        await db.collection("exhibits").document(doc.id).set(data, merge=True)
        count += 1
    print(f"✅ Copied artifacts -> exhibits: {count} docs")


async def migrate_collection_artifact_chunks() -> None:
    count = 0
    async for doc in db.collection("artifact_chunks").stream():
        data = doc.to_dict() or {}
        entity_id = data.get("exhibit_id") or data.get("artifact_id")
        if entity_id:
            data["exhibit_id"] = entity_id
        await db.collection("exhibit_chunks").document(doc.id).set(data, merge=True)
        count += 1
    print(f"✅ Copied artifact_chunks -> exhibit_chunks: {count} docs")


async def backfill_field_exhibit_id(collection_name: str, field_name: str = "artifact_id") -> None:
    updated = 0
    async for doc in db.collection(collection_name).stream():
        data = doc.to_dict() or {}
        if "exhibit_id" in data:
            continue
        artifact_id = data.get(field_name)
        if artifact_id:
            await db.collection(collection_name).document(doc.id).set({"exhibit_id": artifact_id}, merge=True)
            updated += 1
    print(f"✅ Backfilled exhibit_id in {collection_name}: {updated} docs")


async def migrate_qr_urls_in_collections() -> None:
    # collections likely to contain qr_url
    for collection_name in ("museums", "artifacts", "exhibits"):
        updated = 0
        async for doc in db.collection(collection_name).stream():
            data = doc.to_dict() or {}
            qr_url = data.get("qr_url")
            if not isinstance(qr_url, str) or not qr_url:
                continue
            new_qr_url = _rewrite_qr_url(qr_url)
            if new_qr_url != qr_url:
                await db.collection(collection_name).document(doc.id).set({"qr_url": new_qr_url}, merge=True)
                updated += 1
        print(f"✅ Rewrote qr_url query params in {collection_name}: {updated} docs")


async def run() -> None:
    print(f"🚀 Starting migration in project: {PROJECT_ID}")
    await migrate_collection_artifacts_to_exhibits()
    await migrate_collection_artifact_chunks()
    await backfill_field_exhibit_id("analytics_events")
    await backfill_field_exhibit_id("documents")
    await migrate_qr_urls_in_collections()
    print("🎉 Migration completed")


if __name__ == "__main__":
    asyncio.run(run())
