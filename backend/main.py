"""
MuseAI Backend API
AI Agent cho bảo tàng - Gemini Live Agent Challenge 2026
"""

import os
import logging
from typing import Optional

from fastapi import FastAPI, WebSocket, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore

from live.ws_handler import handle_persona_websocket


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
            "websocket": "/ws/persona/{artifact_id}?language=vi"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
