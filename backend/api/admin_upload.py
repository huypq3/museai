"""
Admin image upload endpoints
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from google.cloud import storage
import sys
sys.path.append('..')
from auth.admin import ensure_museum_scope, get_current_admin
import uuid
import os
from urllib.parse import quote

router = APIRouter(prefix="/admin/upload", tags=["admin"])
GCS_BUCKET = os.getenv("GCS_BUCKET", "museai-assets")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    museum_id: str | None = Form(default=None),
    admin=Depends(get_current_admin)
):
    """Upload image to Google Cloud Storage."""
    if museum_id:
        ensure_museum_scope(admin, museum_id)
    elif admin.get("role") == "museum_admin":
        # If museum_id is not passed, museum admin is scoped to their own museum.
        museum_id = admin.get("museum_id")

    # Validate file extension
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(400, "Only jpg/png/webp allowed")
    if (file.content_type or "").lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(415, "Only JPEG/PNG/WebP mime types allowed")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(400, "Empty file")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "File too large, max 5MB")

    # Upload to GCS
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET)
    filename = f"uploads/{uuid.uuid4()}.{ext}"
    blob = bucket.blob(filename)
    blob.upload_from_string(content, content_type=file.content_type)

    # Uniform bucket-level access disables object ACL APIs (e.g. make_public()).
    # Return canonical object URL and rely on bucket-level IAM/public policy.
    object_path = quote(filename, safe="/")
    object_url = f"https://storage.googleapis.com/{GCS_BUCKET}/{object_path}"

    return {"url": object_url}
