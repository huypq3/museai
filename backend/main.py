"""
MuseAI Backend API
AI museum agent backend
"""
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_ENV_PATH = Path(__file__).resolve().parent / ".env"
ROOT_ENV_PATH = ROOT_DIR / ".env"

# Standard: backend uses backend/.env
load_dotenv(BACKEND_ENV_PATH)
# Backward-compatible fallback for legacy root .env setups
if not BACKEND_ENV_PATH.exists() and ROOT_ENV_PATH.exists():
    load_dotenv(ROOT_ENV_PATH)

import os
import logging
import base64
from typing import Optional

from fastapi import FastAPI, WebSocket, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel

from live.ws_handler import handle_persona_websocket
from cms.upload import upload_pdf, get_document_status
from rag.query_engine import answer_with_rag
from vision.recognizer import recognize_artifact
from vision.camera_tour import analyze_frame, generate_commentary
from middleware.security_headers import SecurityHeadersMiddleware
from middleware.audit_log import audit_log
from security.rate_limit import check_rate_limit, check_ws_limits, register_ws_session, unregister_ws_session
from auth.ephemeral import create_ephemeral_token, verify_ephemeral_token

# Import admin routers
from api import (
    admin_auth,
    admin_museums,
    admin_artifacts,
    admin_exhibits,
    admin_upload,
    admin_qr,
    admin_analytics,
    admin_users,
    public_analytics,
    admin_settings,
)


# Logging config
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="MuseAI API",
    version="0.1.0",
    description="AI museum guide backend with Gemini Live voice Q&A"
)

# CORS middleware
def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


default_dev_origins = [
    "http://localhost:3000",
]
raw_origins = os.getenv("ALLOWED_ORIGINS", ",".join(default_dev_origins))
ALLOWED_ORIGINS = [_normalize_origin(o) for o in raw_origins.split(",") if o.strip()]
logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
ENFORCE_HTTPS = os.getenv("ENFORCE_HTTPS", "false").lower() == "true" or APP_ENV in {"production", "prod"}


def _request_is_secure(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto:
        return forwarded_proto.split(",")[0].strip().lower() == "https"
    return request.url.scheme.lower() == "https"


@app.middleware("http")
async def https_redirect_middleware(request: Request, call_next):
    if ENFORCE_HTTPS and not _request_is_secure(request):
        target_url = request.url.replace(scheme="https")
        return RedirectResponse(url=str(target_url), status_code=307)
    return await call_next(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error: %s", exc, exc_info=True, extra={"path": request.url.path, "method": request.method})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.error("HTTP %s: %s", exc.status_code, exc.detail)
    elif exc.status_code == 429:
        logger.warning(
            "Rate limit hit path=%s method=%s ip=%s detail=%s",
            request.url.path,
            request.method,
            request.client.host if request.client else "unknown",
            exc.detail,
        )
        await audit_log(
            event="rate_limit_hit",
            actor="anonymous",
            details={
                "path": request.url.path,
                "method": request.method,
                "ip": request.client.host if request.client else None,
                "detail": str(exc.detail),
            },
        )
    elif exc.status_code in (401, 403):
        logger.warning(
            "Auth failure %s path=%s ip=%s",
            exc.status_code,
            request.url.path,
            request.client.host if request.client else "unknown",
        )
        await audit_log(
            event="forbidden_access",
            actor="anonymous",
            details={"path": request.url.path, "ip": request.client.host if request.client else None},
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.middleware("http")
async def museum_api_rate_limit(request: Request, call_next):
    # public/museum-facing APIs
    if (
        request.url.path.startswith("/vision/")
        or request.url.path.startswith("/qa/")
        or request.url.path.startswith("/artifacts/")
        or request.url.path.startswith("/exhibits/")
    ):
        ip = request.client.host if request.client else "unknown"
        await check_rate_limit(scope="museum_api", key=f"ip:{ip}", limit=300, window_seconds=60)
    return await call_next(request)

# Register admin routers
app.include_router(admin_auth.router)
app.include_router(admin_museums.router)
app.include_router(admin_artifacts.router)
app.include_router(admin_exhibits.router)
app.include_router(admin_upload.router)
app.include_router(admin_qr.router)
app.include_router(admin_analytics.router)
app.include_router(admin_users.router)
app.include_router(public_analytics.router)
app.include_router(admin_settings.router)

# Firestore client (lazy init)
_db: Optional[firestore.AsyncClient] = None


def get_firestore() -> firestore.AsyncClient:
    """Get a singleton Firestore client."""
    global _db
    if _db is None:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026")
        _db = firestore.AsyncClient(project=project_id)
        logger.info(f"Initialized Firestore client for project: {project_id}")
    return _db


async def _get_exhibit_doc(db: firestore.AsyncClient, exhibit_id: str):
    """
    Prefer new collection `exhibits`, fallback legacy `artifacts`.
    """
    exhibit_ref = db.collection("exhibits").document(exhibit_id)
    exhibit_doc = await exhibit_ref.get()
    if exhibit_doc.exists:
        return exhibit_doc
    legacy_ref = db.collection("artifacts").document(exhibit_id)
    return await legacy_ref.get()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "MuseAI API is running 🎭",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "exhibit": "/exhibits/{exhibit_id}",
            "exhibit_legacy_alias": "/artifacts/{artifact_id}",
            "websocket": "/ws/persona/{exhibit_id}?language=vi",
            "upload_pdf": "/admin/upload-pdf/{exhibit_id}",
            "document_status": "/admin/document-status/{exhibit_id}",
            "rag_qa": "/rag/qa/{exhibit_id}",
            "qa_legacy_alias": "/qa/{artifact_id}",
            "vision_recognize": "/vision/recognize/{museum_id}",
            "camera_tour": "/vision/camera-tour/{museum_id}"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Keep health lightweight: do not query Firestore here.
    # Firestore connectivity is exercised on artifact and websocket routes.
    return {
        "status": "ok",
        "service": "museai-backend",
        "version": "0.1.0",
        "gemini_api_key": "configured" if os.getenv("GEMINI_API_KEY") else "missing",
        "gcp_credentials": "configured" if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") else "missing"
    }


@app.get("/exhibits/{exhibit_id}")
async def get_exhibit(exhibit_id: str):
    """
    Get exhibit information from Firestore.
    
    Args:
        exhibit_id: Exhibit ID in Firestore
    
    Returns:
        Dict with exhibit and persona data
    """
    try:
        db = get_firestore()
        
        exhibit_doc = await _get_exhibit_doc(db, exhibit_id)
        
        if not exhibit_doc.exists:
            raise HTTPException(status_code=404, detail=f"Exhibit {exhibit_id} not found")
        
        exhibit_data = exhibit_doc.to_dict()
        exhibit_data["id"] = exhibit_id
        
        # Load persona data (if persona_id exists)
        persona_id = exhibit_data.get("persona_id")
        if persona_id:
            persona_ref = db.collection("personas").document(persona_id)
            persona_doc = await persona_ref.get()
            
            if persona_doc.exists:
                exhibit_data["persona"] = persona_doc.to_dict()
            else:
                logger.warning(f"Persona {persona_id} not found for exhibit {exhibit_id}")
                exhibit_data["persona"] = {}
        else:
            exhibit_data["persona"] = {}
        
        return {
            "exhibit_id": exhibit_id,
            "artifact_id": exhibit_id,  # legacy compatibility
            "data": exhibit_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting exhibit {exhibit_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/artifacts/{artifact_id}")
async def get_artifact_legacy_alias(artifact_id: str):
    """Legacy alias for old clients."""
    return await get_exhibit(artifact_id)


@app.websocket("/ws/persona/{artifact_id}")
async def websocket_persona(
    websocket: WebSocket,
    artifact_id: str,
    language: str = Query(default="vi", description="Language code (vi, en, fr, zh, ja, ko)"),
    token: str | None = Query(default=None),
):
    """
    WebSocket endpoint for real-time voice conversation with Gemini Live API.
    
    Args:
        websocket: WebSocket connection
        artifact_id: Artifact ID
        language: Language code
    """
    try:
        ip = websocket.client.host if websocket.client else "unknown"
        try:
            await check_ws_limits(ip)
        except HTTPException as rl_e:
            await websocket.close(code=4029, reason=str(rl_e.detail))
            await audit_log("ws_limit_exceeded", "anonymous", {"ip": ip, "artifact_id": artifact_id})
            return
        await register_ws_session(ip)

        require_ws_token = os.getenv("WS_REQUIRE_EPHEMERAL_TOKEN", "true").lower() == "true"
        if require_ws_token:
            if not token:
                await websocket.close(code=4001)
                return
            payload = verify_ephemeral_token(token)
            requested_id = payload.get("exhibit_id") or payload.get("artifact_id")
            if requested_id != artifact_id:
                await websocket.close(code=4003)
                return

        # Load exhibit data from Firestore
        db = get_firestore()
        artifact_doc = await _get_exhibit_doc(db, artifact_id)
        
        if not artifact_doc.exists:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "message": f"Artifact {artifact_id} not found"
            })
            await websocket.close()
            return
        
        artifact_data = artifact_doc.to_dict()
        
        # Load persona data
        persona_id = artifact_data.get("persona_id")
        if persona_id:
            persona_ref = db.collection("personas").document(persona_id)
            persona_doc = await persona_ref.get()
            
            if persona_doc.exists:
                artifact_data["persona"] = persona_doc.to_dict()
            else:
                artifact_data["persona"] = {}
        else:
            artifact_data["persona"] = {}
        
        # Start websocket session handler
        await handle_persona_websocket(websocket, artifact_data, language)
        
    except Exception as e:
        logger.error(f"WebSocket error for artifact {artifact_id}: {e}", exc_info=True)
        try:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "message": "Internal server error"
            })
            await websocket.close()
        except:
            pass
    finally:
        ip = websocket.client.host if websocket.client else "unknown"
        await unregister_ws_session(ip)


@app.websocket("/live/ws/{artifact_id}")
async def websocket_live_alias(
    websocket: WebSocket,
    artifact_id: str,
    language: str = Query(default="vi", description="Language code (vi, en, fr, zh, ja, ko)"),
    token: str | None = Query(default=None),
):
    """Alias route for live websocket endpoint."""
    await websocket_persona(websocket=websocket, artifact_id=artifact_id, language=language, token=token)


@app.websocket("/ws/persona/exhibits/{exhibit_id}")
async def websocket_persona_exhibit_alias(
    websocket: WebSocket,
    exhibit_id: str,
    language: str = Query(default="vi", description="Language code (vi, en, fr, zh, ja, ko)"),
    token: str | None = Query(default=None),
):
    await websocket_persona(websocket=websocket, artifact_id=exhibit_id, language=language, token=token)


@app.websocket("/live/ws/exhibits/{exhibit_id}")
async def websocket_live_exhibit_alias(
    websocket: WebSocket,
    exhibit_id: str,
    language: str = Query(default="vi", description="Language code (vi, en, fr, zh, ja, ko)"),
    token: str | None = Query(default=None),
):
    await websocket_persona(websocket=websocket, artifact_id=exhibit_id, language=language, token=token)


# Pydantic models for request bodies
class QARequest(BaseModel):
    """Request body for Q&A endpoint."""
    question: str
    language: str = "vi"


class CameraTourRequest(BaseModel):
    """Request body for Camera Tour endpoint."""
    image_base64: str
    last_artifact_id: Optional[str] = None
    language: str = "vi"


@app.post("/api/session/token/{artifact_id}")
async def create_ws_ephemeral_session_token(
    request: Request,
    artifact_id: str,
    museum_id: str | None = Query(default=None),
):
    ip = request.client.host if request.client else "unknown"
    await check_rate_limit(scope="session_token", key=f"ip:{ip}", limit=30, window_seconds=60)
    token = create_ephemeral_token(exhibit_id=artifact_id, museum_id=museum_id)
    return {"token": token, "expires_in": int(os.getenv("EPHEMERAL_TOKEN_EXPIRE_SECONDS", "3600"))}


@app.post("/api/session/token/exhibits/{exhibit_id}")
async def create_ws_ephemeral_session_token_exhibit(
    request: Request,
    exhibit_id: str,
    museum_id: str | None = Query(default=None),
):
    ip = request.client.host if request.client else "unknown"
    await check_rate_limit(scope="session_token", key=f"ip:{ip}", limit=30, window_seconds=60)
    token = create_ephemeral_token(exhibit_id=exhibit_id, museum_id=museum_id)
    return {"token": token, "expires_in": int(os.getenv("EPHEMERAL_TOKEN_EXPIRE_SECONDS", "3600"))}


@app.post("/admin/upload-pdf/{artifact_id}")
async def upload_pdf_endpoint(
    artifact_id: str,
    file: UploadFile = File(...)
):
    """
    Upload PDF documentation for an artifact and generate RAG chunks.
    
    Args:
        artifact_id: Artifact ID
        file: PDF file upload
    
    Returns:
        Dict with upload result metadata
    """
    try:
        logger.info(f"Receiving PDF upload for artifact: {artifact_id}")
        
        # Validate file type
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Read file bytes
        file_bytes = await file.read()
        
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        logger.info(f"Received PDF file: {file.filename}, size: {len(file_bytes)} bytes")
        
        # Upload and process
        result = await upload_pdf(
            file_bytes=file_bytes,
            filename=file.filename,
            artifact_id=artifact_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/admin/upload-pdf/exhibits/{exhibit_id}")
async def upload_pdf_endpoint_exhibit(
    exhibit_id: str,
    file: UploadFile = File(...),
):
    return await upload_pdf_endpoint(exhibit_id, file)


@app.get("/admin/document-status/{artifact_id}")
async def document_status_endpoint(artifact_id: str):
    """
    Check document status for an artifact.
    
    Args:
        artifact_id: Artifact ID
    
    Returns:
        Dict with document status metadata
    """
    try:
        status = await get_document_status(artifact_id)
        return status
        
    except Exception as e:
        logger.error(f"Error getting document status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/admin/document-status/exhibits/{exhibit_id}")
async def document_status_endpoint_exhibit(exhibit_id: str):
    return await document_status_endpoint(exhibit_id)


@app.post("/rag/qa/{artifact_id}")
async def rag_qa_endpoint(
    artifact_id: str,
    request: QARequest
):
    """
    Answer question with HTTP RAG pipeline (semantic retrieval + grounded generation).
    
    Args:
        artifact_id: Artifact ID
        request: QARequest with question and language
    
    Returns:
        Dict with answer, sources, and grounded status
    """
    try:
        logger.info(f"RAG Q&A request for artifact {artifact_id}: {request.question}")
        
        result = await answer_with_rag(
            question=request.question,
            artifact_id=artifact_id,
            language=request.language
        )
        result["pipeline"] = "rag_http"
        return result
        
    except Exception as e:
        logger.error(f"Error in RAG Q&A endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/rag/qa/exhibits/{exhibit_id}")
async def rag_qa_endpoint_exhibit(
    exhibit_id: str,
    request: QARequest,
):
    return await rag_qa_endpoint(exhibit_id, request)


@app.post("/qa/{artifact_id}")
async def qa_legacy_alias(
    artifact_id: str,
    request: QARequest
):
    """
    Legacy alias for backward compatibility.
    Prefer /rag/qa/{artifact_id} for new clients.
    """
    result = await rag_qa_endpoint(artifact_id=artifact_id, request=request)
    result["deprecated"] = True
    result["message"] = "Use /rag/qa/{artifact_id} (legacy alias route)."
    return result


@app.post("/vision/recognize/{museum_id}")
async def vision_recognize_endpoint(
    request: Request,
    museum_id: str,
    file: UploadFile = File(...)
):
    """
    Recognize an artifact from an image.
    
    Args:
        museum_id: Museum ID
        file: Image file upload (JPEG/PNG)
    
    Returns:
        Dict: {artifact_id, confidence, reasoning, found}
    """
    try:
        logger.info(f"Vision recognize request for museum: {museum_id}")
        ip = request.client.host if request.client else "unknown"
        await check_rate_limit(scope="vision", key=f"ip:{ip}", limit=30, window_seconds=60)
        await audit_log("vision_request", "anonymous", {"museum_id": museum_id, "ip": ip})

        # Read image bytes
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        if len(image_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large, maximum size is 5MB")
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        if (file.content_type or "").lower() not in allowed_types:
            raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP are allowed")
        
        # Run artifact recognition
        result = await recognize_artifact(image_bytes, museum_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in vision recognize endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/vision/camera-tour/{museum_id}")
async def camera_tour_endpoint(
    museum_id: str,
    request: CameraTourRequest
):
    """
    Camera tour mode: detect new artifacts and generate commentary.
    
    Args:
        museum_id: Museum ID
        request: CameraTourRequest with image_base64, last_artifact_id, and language
    
    Returns:
        Dict: {same, artifact_id, confidence, commentary}
    """
    try:
        logger.info(f"Camera tour request for museum: {museum_id}")
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(request.image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")
        
        # Analyze frame
        result = await analyze_frame(
            image_bytes=image_bytes,
            museum_id=museum_id,
            last_artifact_id=request.last_artifact_id
        )
        
        # If a new artifact is detected, generate commentary
        commentary = None
        if not result["same"] and result["artifact_id"] != "unknown":
            commentary = await generate_commentary(
                artifact_id=result["artifact_id"],
                language=request.language
            )
        
        return {
            "same": result["same"],
            "artifact_id": result["artifact_id"],
            "confidence": result["confidence"],
            "commentary": commentary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in camera tour endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
