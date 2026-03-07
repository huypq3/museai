"""
Admin exhibit endpoints (new naming) with backward-compatible delegation
to the existing artifact service layer.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

import sys

sys.path.append("..")
from auth.admin import get_current_admin  # noqa: E402
from api import admin_artifacts  # noqa: E402

router = APIRouter(prefix="/admin/exhibits", tags=["admin"])


@router.get("/")
async def list_exhibits(
    museum_id: str | None = Query(default=None),
    admin=Depends(get_current_admin),
):
    return await admin_artifacts.list_artifacts(museum_id=museum_id, admin=admin)


@router.post("/")
async def create_exhibit(body: admin_artifacts.ArtifactCreate, admin=Depends(get_current_admin)):
    return await admin_artifacts.create_artifact(body=body, admin=admin)


@router.get("/{exhibit_id}")
async def get_exhibit(exhibit_id: str, admin=Depends(get_current_admin)):
    return await admin_artifacts.get_artifact(artifact_id=exhibit_id, admin=admin)


@router.put("/{exhibit_id}")
async def update_exhibit(
    exhibit_id: str,
    body: admin_artifacts.ArtifactUpdate,
    admin=Depends(get_current_admin),
):
    return await admin_artifacts.update_artifact(artifact_id=exhibit_id, body=body, admin=admin)


@router.delete("/{exhibit_id}")
async def delete_exhibit(exhibit_id: str, admin=Depends(get_current_admin)):
    return await admin_artifacts.delete_artifact(artifact_id=exhibit_id, admin=admin)
