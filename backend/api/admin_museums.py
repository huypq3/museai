"""
Admin museum management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import firestore
import sys
sys.path.append('..')
from auth.admin import verify_token

router = APIRouter(prefix="/admin/museums", tags=["admin"])
db = firestore.AsyncClient()

class MuseumCreate(BaseModel):
    name: str
    name_en: str
    description: str = ""
    address: str = ""
    logo_url: str = ""

class MuseumUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    logo_url: str | None = None

@router.get("/")
async def list_museums(admin=Depends(verify_token)):
    """Lấy danh sách tất cả bảo tàng"""
    museums = []
    async for doc in db.collection("museums").stream():
        data = doc.to_dict()
        data["id"] = doc.id
        museums.append(data)
    return museums

@router.post("/")
async def create_museum(body: MuseumCreate, admin=Depends(verify_token)):
    """Tạo bảo tàng mới"""
    museum_id = body.name_en.lower().replace(" ", "_")
    await db.collection("museums").document(museum_id).set({
        **body.dict(),
        "created_at": firestore.SERVER_TIMESTAMP,
        "artifact_count": 0,
    })
    return {"id": museum_id, **body.dict()}

@router.put("/{museum_id}")
async def update_museum(museum_id: str, body: MuseumUpdate, admin=Depends(verify_token)):
    """Cập nhật thông tin bảo tàng"""
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    await db.collection("museums").document(museum_id).update(update_data)
    return {"success": True}

@router.delete("/{museum_id}")
async def delete_museum(museum_id: str, admin=Depends(verify_token)):
    """Xóa bảo tàng"""
    await db.collection("museums").document(museum_id).delete()
    return {"success": True}
