"""
Admin artifact management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import firestore
import sys
sys.path.append('..')
from auth.admin import verify_token
from typing import Optional

router = APIRouter(prefix="/admin/artifacts", tags=["admin"])
db = firestore.AsyncClient()

class SceneItem(BaseModel):
    keyword: str
    image_url: str
    trigger_words: list[str]

class ArtifactCreate(BaseModel):
    museum_id: str
    name: str
    name_en: str
    era: str = ""
    location: str = ""
    description: str = ""
    image_url: str = ""
    system_prompt: str = ""

class ArtifactUpdate(BaseModel):
    name: Optional[str] = None
    era: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    system_prompt: Optional[str] = None
    scenes: Optional[list[SceneItem]] = None

@router.get("/")
async def list_artifacts(museum_id: str, admin=Depends(verify_token)):
    """Lấy danh sách hiện vật của museum"""
    artifacts = []
    query = db.collection("artifacts").where("museum_id", "==", museum_id)
    async for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        artifacts.append(data)
    return artifacts

@router.post("/")
async def create_artifact(body: ArtifactCreate, admin=Depends(verify_token)):
    """Tạo hiện vật mới"""
    artifact_id = body.name_en.lower().replace(" ", "_")
    data = {**body.dict(), "scenes": [], "created_at": firestore.SERVER_TIMESTAMP}
    await db.collection("artifacts").document(artifact_id).set(data)
    # Tăng artifact_count của museum
    await db.collection("museums").document(body.museum_id).update({
        "artifact_count": firestore.Increment(1)
    })
    return {"id": artifact_id, **data}

@router.get("/{artifact_id}")
async def get_artifact(artifact_id: str, admin=Depends(verify_token)):
    """Lấy chi tiết hiện vật"""
    doc = await db.collection("artifacts").document(artifact_id).get()
    if not doc.exists:
        raise HTTPException(404, "Not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.put("/{artifact_id}")
async def update_artifact(
    artifact_id: str, body: ArtifactUpdate, admin=Depends(verify_token)
):
    """Cập nhật thông tin hiện vật"""
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    if "scenes" in update_data:
        # Convert SceneItem objects to dict
        update_data["scenes"] = [
            s.dict() if hasattr(s, "dict") else s
            for s in update_data["scenes"]
        ]
    await db.collection("artifacts").document(artifact_id).update(update_data)
    return {"success": True}

@router.delete("/{artifact_id}")
async def delete_artifact(artifact_id: str, admin=Depends(verify_token)):
    """Xóa hiện vật"""
    doc = await db.collection("artifacts").document(artifact_id).get()
    if doc.exists:
        museum_id = doc.to_dict().get("museum_id")
        await db.collection("artifacts").document(artifact_id).delete()
        # Giảm artifact_count của museum
        if museum_id:
            await db.collection("museums").document(museum_id).update({
                "artifact_count": firestore.Increment(-1)
            })
    return {"success": True}
