"""
Admin exhibit management endpoints with ACL.
"""

from __future__ import annotations

import re
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud import firestore
from pydantic import BaseModel, Field

import sys

sys.path.append("..")
from auth.admin import ensure_museum_scope, get_current_admin, get_db  # noqa: E402
from live.rag_context import add_embeddings_to_chunks  # noqa: E402
from middleware.audit_log import audit_log  # noqa: E402

router = APIRouter(prefix="/admin/exhibits", tags=["admin"])
PRIMARY_COLLECTION = "exhibits"


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return slug.strip("_") or "exhibit"


EXHIBIT_REQUIRED_FIELDS = [
    "name",
    "name_en",
    "category",
    "period",
    "description.vi",
    "description.en",
    "location.hall",
    "primary_image_url",
    "visual_features.description",
]


def _get_by_path(obj: dict[str, Any], path: str):
    cur: Any = obj
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _missing_required(data: dict[str, Any], fields: list[str]) -> list[str]:
    missing: list[str] = []
    for field in fields:
        value = _get_by_path(data, field)
        if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
            missing.append(field)
    return missing


class SceneItem(BaseModel):
    keyword: str
    image_url: str
    trigger_words: list[str] = Field(default_factory=list)


class ExhibitCreate(BaseModel):
    museum_id: str
    name: str
    name_en: str
    category: str = "other"
    period: str = ""
    origin: str = ""
    era: str = ""
    location: Any = ""
    description: Any = ""
    image_url: str = ""
    primary_image_url: str = ""
    gallery_images: list[str] = Field(default_factory=list)
    visual_features: dict[str, Any] = Field(default_factory=dict)
    scenes: list[SceneItem] = Field(default_factory=list)
    knowledge_base: list[dict] = Field(default_factory=list)
    system_prompt: str = ""
    status: Literal["published", "draft"] = "draft"


class ExhibitUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    category: Optional[str] = None
    period: Optional[str] = None
    origin: Optional[str] = None
    era: Optional[str] = None
    location: Optional[Any] = None
    description: Optional[Any] = None
    image_url: Optional[str] = None
    primary_image_url: Optional[str] = None
    gallery_images: Optional[list[str]] = None
    visual_features: Optional[dict[str, Any]] = None
    system_prompt: Optional[str] = None
    scenes: Optional[list[SceneItem]] = None
    knowledge_base: Optional[list[dict]] = None
    status: Optional[Literal["published", "draft"]] = None


async def _get_exhibit_or_404(exhibit_id: str) -> tuple[dict[str, Any], firestore.AsyncClient]:
    db = get_db()
    doc = await db.collection(PRIMARY_COLLECTION).document(exhibit_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Exhibit not found")
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data, db


@router.get("")
@router.get("/")
async def list_exhibits(
    museum_id: str | None = Query(default=None),
    admin=Depends(get_current_admin),
):
    db = get_db()
    exhibits: list[dict[str, Any]] = []

    effective_museum_id = museum_id
    if admin["role"] == "museum_admin":
        if museum_id and museum_id != admin.get("museum_id"):
            raise HTTPException(status_code=403, detail="Access denied")
        effective_museum_id = admin.get("museum_id")
    if not effective_museum_id:
        query = db.collection(PRIMARY_COLLECTION)
    else:
        query = db.collection(PRIMARY_COLLECTION).where("museum_id", "==", effective_museum_id)

    async for doc in query.stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        exhibits.append(data)
    return exhibits


@router.post("")
@router.post("/")
async def create_exhibit(body: ExhibitCreate, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, body.museum_id)
    db = get_db()

    exhibit_id = _slugify(body.name_en or body.name)
    ref = db.collection(PRIMARY_COLLECTION).document(exhibit_id)
    if (await ref.get()).exists:
        raise HTTPException(status_code=409, detail="Exhibit already exists")

    data = body.model_dump()
    data["id"] = exhibit_id
    data["created_at"] = firestore.SERVER_TIMESTAMP
    data["total_scans"] = 0
    data["total_conversations"] = 0
    if not data.get("primary_image_url"):
        data["primary_image_url"] = data.get("image_url", "")
    if data.get("knowledge_base"):
        chunks = []
        for idx, chunk in enumerate(data["knowledge_base"]):
            c = dict(chunk)
            if not c.get("chunk_id"):
                c["chunk_id"] = f"chunk_{idx + 1:03d}"
            c["category"] = c.get("category") or "other"
            c["content"] = (c.get("content") or "").strip()
            chunks.append(c)
        if chunks:
            add_embeddings_to_chunks(chunks)
        data["knowledge_base"] = chunks

    if data.get("status") == "published":
        missing = _missing_required(data, EXHIBIT_REQUIRED_FIELDS)
        kb_count = len(data.get("knowledge_base") or [])
        if missing or kb_count < 2:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Exhibit missing required fields for published status",
                    "missing": missing,
                    "knowledge_base_count": kb_count,
                },
            )
    await ref.set(data)

    await db.collection("museums").document(body.museum_id).set(
        {"exhibit_count": firestore.Increment(1)}, merge=True
    )
    if data.get("status") == "published":
        await audit_log(
            event="exhibit_published",
            actor=str(admin.get("username", admin.get("uid", "unknown"))),
            details={"exhibit_id": exhibit_id, "museum_id": body.museum_id},
        )
    return {
        "id": exhibit_id,
        "museum_id": body.museum_id,
        "name": body.name,
        "status": data.get("status", "draft"),
    }


@router.get("/{exhibit_id}")
async def get_exhibit(exhibit_id: str, admin=Depends(get_current_admin)):
    data, _ = await _get_exhibit_or_404(exhibit_id)
    ensure_museum_scope(admin, str(data.get("museum_id", "")))
    return data


@router.put("/{exhibit_id}")
async def update_exhibit(exhibit_id: str, body: ExhibitUpdate, admin=Depends(get_current_admin)):
    existing, db = await _get_exhibit_or_404(exhibit_id)
    ensure_museum_scope(admin, str(existing.get("museum_id", "")))

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if "scenes" in update_data:
        update_data["scenes"] = [
            s.model_dump() if hasattr(s, "model_dump") else s for s in update_data["scenes"]
        ]

    if "knowledge_base" in update_data:
        chunks = []
        for idx, chunk in enumerate(update_data["knowledge_base"] or []):
            c = dict(chunk)
            if not c.get("chunk_id"):
                c["chunk_id"] = f"chunk_{idx + 1:03d}"
            c["category"] = c.get("category") or "other"
            c["content"] = (c.get("content") or "").strip()
            chunks.append(c)
        if chunks:
            add_embeddings_to_chunks(chunks)
        update_data["knowledge_base"] = chunks

    if update_data.get("status") == "published":
        merged = {**existing, **update_data}
        missing = _missing_required(merged, EXHIBIT_REQUIRED_FIELDS)
        kb_count = len(merged.get("knowledge_base") or [])
        if missing or kb_count < 2:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Exhibit missing required fields for published status",
                    "missing": missing,
                    "knowledge_base_count": kb_count,
                },
            )

    if update_data:
        await db.collection(PRIMARY_COLLECTION).document(exhibit_id).set(update_data, merge=True)
        if update_data.get("status") == "published":
            await audit_log(
                event="exhibit_published",
                actor=str(admin.get("username", admin.get("uid", "unknown"))),
                details={"exhibit_id": exhibit_id, "museum_id": existing.get("museum_id")},
            )
    return {"success": True}


@router.delete("/{exhibit_id}")
async def delete_exhibit(exhibit_id: str, admin=Depends(get_current_admin)):
    existing, db = await _get_exhibit_or_404(exhibit_id)
    ensure_museum_scope(admin, str(existing.get("museum_id", "")))

    museum_id = existing.get("museum_id")
    await db.collection(PRIMARY_COLLECTION).document(exhibit_id).delete()
    if museum_id:
        await db.collection("museums").document(museum_id).set(
            {"exhibit_count": firestore.Increment(-1)}, merge=True
        )
    await audit_log(
        event="exhibit_deleted",
        actor=str(admin.get("username", admin.get("uid", "unknown"))),
        details={"exhibit_id": exhibit_id, "museum_id": museum_id},
    )
    return {"success": True}
