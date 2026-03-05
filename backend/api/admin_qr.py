"""
Admin QR endpoints.
"""

from __future__ import annotations

import base64
import io
import zipfile
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

try:
    import qrcode
except Exception:  # pragma: no cover - optional runtime dependency
    qrcode = None

import sys

sys.path.append("..")
from auth.admin import ensure_museum_scope, get_current_admin, get_db  # noqa: E402

router = APIRouter(prefix="/admin/qr", tags=["admin"])


class GenerateQRBody(BaseModel):
    museum_id: str
    artifact_id: str | None = None


def _to_data_url(value: str) -> str:
    if qrcode is None:
        raise HTTPException(
            status_code=500,
            detail="QR generator dependency missing. Install backend requirements (qrcode[pil]).",
        )
    img = qrcode.make(value)
    buff = io.BytesIO()
    img.save(buff, format="PNG")
    encoded = base64.b64encode(buff.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def _to_png_bytes(value: str) -> bytes:
    if qrcode is None:
        raise HTTPException(
            status_code=500,
            detail="QR generator dependency missing. Install backend requirements (qrcode[pil]).",
        )
    img = qrcode.make(value)
    buff = io.BytesIO()
    img.save(buff, format="PNG")
    return buff.getvalue()


@router.post("/generate")
async def generate_qr(body: GenerateQRBody, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, body.museum_id)
    db = get_db()
    base_url = "https://museai.app/welcome"

    params = {"museum": body.museum_id}
    if body.artifact_id:
        params["artifact"] = body.artifact_id
    qr_url = f"{base_url}?{urlencode(params)}"
    qr_data_url = _to_data_url(qr_url)

    if body.artifact_id:
        artifact_ref = db.collection("artifacts").document(body.artifact_id)
        artifact_doc = await artifact_ref.get()
        if not artifact_doc.exists:
            raise HTTPException(status_code=404, detail="Artifact not found")
        artifact_data = artifact_doc.to_dict() or {}
        if artifact_data.get("museum_id") != body.museum_id:
            raise HTTPException(status_code=403, detail="Artifact does not belong to this museum")
        await artifact_ref.set({"qr_url": qr_url}, merge=True)
    else:
        await db.collection("museums").document(body.museum_id).set(
            {"qr_url": qr_url}, merge=True
        )

    return {"qr_data_url": qr_data_url, "qr_url": qr_url}


@router.get("/museum/{museum_id}")
async def get_museum_qrs(museum_id: str, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, museum_id)
    db = get_db()

    museum_doc = await db.collection("museums").document(museum_id).get()
    if not museum_doc.exists:
        raise HTTPException(status_code=404, detail="Museum not found")
    museum_data = museum_doc.to_dict() or {}
    museum_qr_url = museum_data.get("qr_url")
    if not museum_qr_url:
        museum_qr_url = f"https://museai.app/welcome?museum={museum_id}"

    artifacts = []
    query = db.collection("artifacts").where("museum_id", "==", museum_id)
    async for doc in query.stream():
        data = doc.to_dict() or {}
        url = data.get("qr_url") or f"https://museai.app/welcome?museum={museum_id}&artifact={doc.id}"
        artifacts.append({"artifact_id": doc.id, "name": data.get("name", doc.id), "qr_url": url})

    return {
        "museum_id": museum_id,
        "museum_qr": {"qr_url": museum_qr_url, "qr_data_url": _to_data_url(museum_qr_url)},
        "artifacts": [
            {**a, "qr_data_url": _to_data_url(a["qr_url"])}
            for a in artifacts
        ],
    }


@router.get("/museum/{museum_id}/zip")
async def get_museum_qrs_zip(museum_id: str, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, museum_id)
    payload = await get_museum_qrs(museum_id, admin)
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        museum_url = payload["museum_qr"]["qr_url"]
        zf.writestr(f"{museum_id}/museum_qr.png", _to_png_bytes(museum_url))
        for item in payload["artifacts"]:
            safe_name = item["artifact_id"].replace("/", "_")
            zf.writestr(f"{museum_id}/{safe_name}.png", _to_png_bytes(item["qr_url"]))
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="qr-{museum_id}.zip"'},
    )
