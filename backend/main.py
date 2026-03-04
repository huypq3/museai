"""
MuseAI Backend API
AI Agent cho bảo tàng - Gemini Live Agent Challenge 2026
"""
from dotenv import load_dotenv
load_dotenv()

import os
import logging
import base64
from typing import Optional

from fastapi import FastAPI, WebSocket, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel

from live.ws_handler import handle_persona_websocket
from cms.upload import upload_pdf, get_document_status
from rag.query_engine import answer_with_rag
from vision.recognizer import recognize_artifact
from vision.camera_tour import analyze_frame, generate_commentary

# Import admin routers
from api import admin_auth, admin_museums, admin_artifacts, admin_upload


# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Khởi tạo FastAPI app
app = FastAPI(
    title="MuseAI API",
    version="0.1.0",
    description="AI Agent cho bảo tàng - Voice Q&A với Gemini Live API"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register admin routers
app.include_router(admin_auth.router)
app.include_router(admin_museums.router)
app.include_router(admin_artifacts.router)
app.include_router(admin_upload.router)

# Firestore client (lazy init)
_db: Optional[firestore.AsyncClient] = None


def get_firestore() -> firestore.AsyncClient:
    """Lấy Firestore client (singleton pattern)."""
    global _db
    if _db is None:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026")
        _db = firestore.AsyncClient(project=project_id)
        logger.info(f"Initialized Firestore client for project: {project_id}")
    return _db


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "MuseAI API is running 🎭",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "artifact": "/artifacts/{artifact_id}",
            "websocket": "/ws/persona/{artifact_id}?language=vi",
            "upload_pdf": "/admin/upload-pdf/{artifact_id}",
            "document_status": "/admin/document-status/{artifact_id}",
            "qa": "/qa/{artifact_id}",
            "vision_recognize": "/vision/recognize/{museum_id}",
            "camera_tour": "/vision/camera-tour/{museum_id}"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Đơn giản hóa: chỉ trả về status, không query Firestore
    # Firestore connection sẽ được test khi gọi /artifacts hoặc WebSocket
    return {
        "status": "ok",
        "service": "museai-backend",
        "version": "0.1.0",
        "gemini_api_key": "configured" if os.getenv("GEMINI_API_KEY") else "missing",
        "gcp_credentials": "configured" if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") else "missing"
    }


@app.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: str):
    """
    Lấy thông tin artifact từ Firestore.
    
    Args:
        artifact_id: ID của artifact trong Firestore
    
    Returns:
        Dict chứa thông tin artifact và persona
    """
    try:
        db = get_firestore()
        
        # Lấy artifact document
        artifact_ref = db.collection("artifacts").document(artifact_id)
        artifact_doc = await artifact_ref.get()
        
        if not artifact_doc.exists:
            raise HTTPException(status_code=404, detail=f"Artifact {artifact_id} not found")
        
        artifact_data = artifact_doc.to_dict()
        
        # Lấy persona data (nếu có persona_id)
        persona_id = artifact_data.get("persona_id")
        if persona_id:
            persona_ref = db.collection("personas").document(persona_id)
            persona_doc = await persona_ref.get()
            
            if persona_doc.exists:
                artifact_data["persona"] = persona_doc.to_dict()
            else:
                logger.warning(f"Persona {persona_id} not found for artifact {artifact_id}")
                artifact_data["persona"] = {}
        else:
            artifact_data["persona"] = {}
        
        return {
            "artifact_id": artifact_id,
            "data": artifact_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact {artifact_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/persona/{artifact_id}")
async def websocket_persona(
    websocket: WebSocket,
    artifact_id: str,
    language: str = Query(default="vi", description="Mã ngôn ngữ (vi, en, fr, zh, ja, ko)")
):
    """
    WebSocket endpoint cho voice conversation với Gemini Live API.
    
    Args:
        websocket: WebSocket connection
        artifact_id: ID của artifact
        language: Mã ngôn ngữ
    """
    try:
        # Lấy artifact data từ Firestore
        db = get_firestore()
        artifact_ref = db.collection("artifacts").document(artifact_id)
        artifact_doc = await artifact_ref.get()
        
        if not artifact_doc.exists:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "message": f"Artifact {artifact_id} not found"
            })
            await websocket.close()
            return
        
        artifact_data = artifact_doc.to_dict()
        
        # Lấy persona data
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
        
        # Xử lý WebSocket session
        await handle_persona_websocket(websocket, artifact_data, language)
        
    except Exception as e:
        logger.error(f"WebSocket error for artifact {artifact_id}: {e}", exc_info=True)
        try:
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
            await websocket.close()
        except:
            pass


# Pydantic models cho request bodies
class QARequest(BaseModel):
    """Request body cho Q&A endpoint."""
    question: str
    language: str = "vi"


class CameraTourRequest(BaseModel):
    """Request body cho Camera Tour endpoint."""
    image_base64: str
    last_artifact_id: Optional[str] = None
    language: str = "vi"


@app.post("/admin/upload-pdf/{artifact_id}")
async def upload_pdf_endpoint(
    artifact_id: str,
    file: UploadFile = File(...)
):
    """
    Upload PDF tài liệu cho artifact và tạo RAG chunks.
    
    Args:
        artifact_id: ID của artifact
        file: PDF file upload
    
    Returns:
        Dict với thông tin upload result
    """
    try:
        logger.info(f"Receiving PDF upload for artifact: {artifact_id}")
        
        # Kiểm tra file type
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Đọc file content
        file_bytes = await file.read()
        
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        logger.info(f"Received PDF file: {file.filename}, size: {len(file_bytes)} bytes")
        
        # Upload và process
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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/document-status/{artifact_id}")
async def document_status_endpoint(artifact_id: str):
    """
    Kiểm tra trạng thái document của artifact.
    
    Args:
        artifact_id: ID của artifact
    
    Returns:
        Dict với thông tin document status
    """
    try:
        status = await get_document_status(artifact_id)
        return status
        
    except Exception as e:
        logger.error(f"Error getting document status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/qa/{artifact_id}")
async def qa_endpoint(
    artifact_id: str,
    request: QARequest
):
    """
    Trả lời câu hỏi với RAG grounding.
    
    Args:
        artifact_id: ID của artifact
        request: QARequest với question và language
    
    Returns:
        Dict với answer, sources, grounded status
    """
    try:
        logger.info(f"Q&A request for artifact {artifact_id}: {request.question}")
        
        result = await answer_with_rag(
            question=request.question,
            artifact_id=artifact_id,
            language=request.language
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in Q&A endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vision/recognize/{museum_id}")
async def vision_recognize_endpoint(
    museum_id: str,
    file: UploadFile = File(...)
):
    """
    Nhận diện hiện vật từ ảnh.
    
    Args:
        museum_id: ID của bảo tàng
        file: Image file upload (JPEG/PNG)
    
    Returns:
        Dict: {artifact_id, confidence, reasoning, found}
    """
    try:
        logger.info(f"Vision recognize request for museum: {museum_id}")
        
        # Đọc image bytes
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Nhận diện artifact
        result = await recognize_artifact(image_bytes, museum_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in vision recognize endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vision/camera-tour/{museum_id}")
async def camera_tour_endpoint(
    museum_id: str,
    request: CameraTourRequest
):
    """
    Camera Tour mode - Phát hiện hiện vật mới và generate commentary.
    
    Args:
        museum_id: ID của bảo tàng
        request: CameraTourRequest với image_base64, last_artifact_id, language
    
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
        
        # Phân tích frame
        result = await analyze_frame(
            image_bytes=image_bytes,
            museum_id=museum_id,
            last_artifact_id=request.last_artifact_id
        )
        
        # Nếu artifact mới → generate commentary
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
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
