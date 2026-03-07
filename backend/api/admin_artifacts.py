"""
Admin artifact management endpoints with ACL.
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

router = APIRouter(prefix="/admin/artifacts", tags=["admin"])
PRIMARY_COLLECTION = "exhibits"
LEGACY_COLLECTION = "artifacts"


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return slug.strip("_") or "exhibit"


ARTIFACT_REQUIRED_FIELDS = [
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


class ArtifactCreate(BaseModel):
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


class ArtifactUpdate(BaseModel):
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


async def _get_artifact_or_404(artifact_id: str) -> tuple[dict[str, Any], firestore.AsyncClient]:
    db = get_db()
    doc = await db.collection(PRIMARY_COLLECTION).document(artifact_id).get()
    if not doc.exists:
        doc = await db.collection(LEGACY_COLLECTION).document(artifact_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Artifact not found")
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data, db


@router.get("/")
async def list_artifacts(
    museum_id: str | None = Query(default=None),
    admin=Depends(get_current_admin),
):
    db = get_db()
    artifacts: list[dict[str, Any]] = []

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
        artifacts.append(data)
    if artifacts:
        return artifacts

    # Backward compatibility if exhibits collection is empty.
    if not effective_museum_id:
        query = db.collection(LEGACY_COLLECTION)
    else:
        query = db.collection(LEGACY_COLLECTION).where("museum_id", "==", effective_museum_id)
    async for doc in query.stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        artifacts.append(data)
    return artifacts


@router.post("/")
async def create_artifact(body: ArtifactCreate, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, body.museum_id)
    db = get_db()

    artifact_id = _slugify(body.name_en or body.name)
    ref = db.collection(PRIMARY_COLLECTION).document(artifact_id)
    legacy_ref = db.collection(LEGACY_COLLECTION).document(artifact_id)
    if (await ref.get()).exists or (await legacy_ref.get()).exists:
        raise HTTPException(status_code=409, detail="Artifact already exists")

    data = body.model_dump()
    data["id"] = artifact_id
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
        missing = _missing_required(data, ARTIFACT_REQUIRED_FIELDS)
        kb_count = len(data.get("knowledge_base") or [])
        if missing or kb_count < 2:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Artifact missing required fields for published status",
                    "missing": missing,
                    "knowledge_base_count": kb_count,
                },
            )
    await ref.set(data)
    # Keep legacy collection in sync during migration window.
    await legacy_ref.set(data, merge=True)

    await db.collection("museums").document(body.museum_id).set(
        {"artifact_count": firestore.Increment(1)}, merge=True
    )
    if data.get("status") == "published":
        await audit_log(
            event="artifact_published",
            actor=str(admin.get("username", admin.get("uid", "unknown"))),
            details={"artifact_id": artifact_id, "museum_id": body.museum_id},
        )
    return {
        "id": artifact_id,
        "museum_id": body.museum_id,
        "name": body.name,
        "status": data.get("status", "draft"),
    }


@router.get("/{artifact_id}")
async def get_artifact(artifact_id: str, admin=Depends(get_current_admin)):
    data, _ = await _get_artifact_or_404(artifact_id)
    ensure_museum_scope(admin, str(data.get("museum_id", "")))
    return data


@router.put("/{artifact_id}")
async def update_artifact(artifact_id: str, body: ArtifactUpdate, admin=Depends(get_current_admin)):
    existing, db = await _get_artifact_or_404(artifact_id)
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
        missing = _missing_required(merged, ARTIFACT_REQUIRED_FIELDS)
        kb_count = len(merged.get("knowledge_base") or [])
        if missing or kb_count < 2:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Artifact missing required fields for published status",
                    "missing": missing,
                    "knowledge_base_count": kb_count,
                },
            )

    if update_data:
        await db.collection(PRIMARY_COLLECTION).document(artifact_id).set(update_data, merge=True)
        await db.collection(LEGACY_COLLECTION).document(artifact_id).set(update_data, merge=True)
        if update_data.get("status") == "published":
            await audit_log(
                event="artifact_published",
                actor=str(admin.get("username", admin.get("uid", "unknown"))),
                details={"artifact_id": artifact_id, "museum_id": existing.get("museum_id")},
            )
    return {"success": True}


@router.delete("/{artifact_id}")
async def delete_artifact(artifact_id: str, admin=Depends(get_current_admin)):
    existing, db = await _get_artifact_or_404(artifact_id)
    ensure_museum_scope(admin, str(existing.get("museum_id", "")))

    museum_id = existing.get("museum_id")
    await db.collection(PRIMARY_COLLECTION).document(artifact_id).delete()
    await db.collection(LEGACY_COLLECTION).document(artifact_id).delete()
    if museum_id:
        await db.collection("museums").document(museum_id).set(
            {"artifact_count": firestore.Increment(-1)}, merge=True
        )
    await audit_log(
        event="artifact_deleted",
        actor=str(admin.get("username", admin.get("uid", "unknown"))),
        details={"artifact_id": artifact_id, "museum_id": museum_id},
    )
    return {"success": True}
