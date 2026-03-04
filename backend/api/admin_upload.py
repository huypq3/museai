"""
Admin image upload endpoints
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from google.cloud import storage
import sys
sys.path.append('..')
from auth.admin import verify_token
import uuid
import os

router = APIRouter(prefix="/admin/upload", tags=["admin"])
GCS_BUCKET = os.getenv("GCS_BUCKET", "museai-assets")

@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    admin=Depends(verify_token)
):
    """Upload ảnh lên Google Cloud Storage"""
    # Validate file extension
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(400, "Only jpg/png/webp allowed")
    
    # Upload to GCS
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET)
    filename = f"uploads/{uuid.uuid4()}.{ext}"
    blob = bucket.blob(filename)
    content = await file.read()
    blob.upload_from_string(content, content_type=file.content_type)
    blob.make_public()
    
    return {"url": blob.public_url}
