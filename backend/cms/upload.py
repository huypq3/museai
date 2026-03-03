"""
CMS Upload - Upload PDF tài liệu và tạo RAG chunks.
"""

import os
import logging
from typing import Dict
from google.cloud import storage, firestore
import asyncio

from rag.chunker import extract_chunks_from_bytes
from rag.embedder import embed_and_store_chunks


logger = logging.getLogger(__name__)


async def upload_pdf(
    file_bytes: bytes,
    filename: str,
    artifact_id: str,
    project_id: str = "museai-2026",
    bucket_name: str = "museai-documents"
) -> Dict:
    """
    Upload PDF lên Cloud Storage và tạo RAG chunks.
    
    Args:
        file_bytes: PDF file content
        filename: Tên file gốc
        artifact_id: ID của artifact
        project_id: GCP project ID
        bucket_name: Cloud Storage bucket name
    
    Returns:
        Dict:
            - artifact_id: ID của artifact
            - chunk_count: số chunks đã tạo
            - status: "success" hoặc "error"
            - gcs_path: đường dẫn file trên GCS
    """
    try:
        logger.info(f"Uploading PDF for artifact: {artifact_id}")
        
        # 1. Upload PDF lên Cloud Storage
        storage_client = storage.Client(project=project_id)
        bucket = storage_client.bucket(bucket_name)
        
        # Đường dẫn: {artifact_id}/original.pdf
        blob_path = f"{artifact_id}/original.pdf"
        blob = bucket.blob(blob_path)
        
        # Upload
        blob.upload_from_string(file_bytes, content_type="application/pdf")
        gcs_path = f"gs://{bucket_name}/{blob_path}"
        
        logger.info(f"Uploaded PDF to: {gcs_path}")
        
        # 2. Extract chunks từ PDF bytes
        chunks = extract_chunks_from_bytes(
            pdf_bytes=file_bytes,
            artifact_id=artifact_id,
            chunk_size=512,
            overlap=50
        )
        
        if not chunks:
            logger.warning(f"No chunks extracted from PDF for artifact: {artifact_id}")
            return {
                "artifact_id": artifact_id,
                "chunk_count": 0,
                "status": "error",
                "message": "No text content found in PDF",
                "gcs_path": gcs_path
            }
        
        # 3. Embed và store chunks vào Firestore
        await embed_and_store_chunks(
            chunks=chunks,
            artifact_id=artifact_id,
            project_id=project_id
        )
        
        # 4. Lưu metadata vào Firestore collection "documents"
        db = firestore.AsyncClient(project=project_id)
        doc_ref = db.collection("documents").document(artifact_id)
        
        await doc_ref.set({
            "artifact_id": artifact_id,
            "filename": filename,
            "gcs_path": gcs_path,
            "chunk_count": len(chunks),
            "uploaded_at": firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Successfully processed PDF: {len(chunks)} chunks created")
        
        return {
            "artifact_id": artifact_id,
            "chunk_count": len(chunks),
            "status": "success",
            "gcs_path": gcs_path
        }
        
    except Exception as e:
        logger.error(f"Error uploading PDF: {e}", exc_info=True)
        return {
            "artifact_id": artifact_id,
            "chunk_count": 0,
            "status": "error",
            "message": str(e)
        }


async def get_document_status(
    artifact_id: str,
    project_id: str = "museai-2026"
) -> Dict:
    """
    Kiểm tra trạng thái document của artifact.
    
    Args:
        artifact_id: ID của artifact
        project_id: GCP project ID
    
    Returns:
        Dict:
            - artifact_id: ID của artifact
            - chunk_count: số chunks hiện có
            - has_document: True nếu có document
            - document_info: thông tin document (nếu có)
    """
    try:
        logger.info(f"Getting document status for artifact: {artifact_id}")
        
        db = firestore.AsyncClient(project=project_id)
        
        # Kiểm tra document metadata
        doc_ref = db.collection("documents").document(artifact_id)
        doc_snapshot = await doc_ref.get()
        
        # Đếm chunks
        chunks_ref = db.collection("artifact_chunks").where("artifact_id", "==", artifact_id)
        chunks_docs = await chunks_ref.get()
        chunk_count = len(chunks_docs)
        
        if doc_snapshot.exists:
            doc_data = doc_snapshot.to_dict()
            return {
                "artifact_id": artifact_id,
                "chunk_count": chunk_count,
                "has_document": True,
                "document_info": {
                    "filename": doc_data.get("filename"),
                    "gcs_path": doc_data.get("gcs_path"),
                    "uploaded_at": doc_data.get("uploaded_at")
                }
            }
        else:
            return {
                "artifact_id": artifact_id,
                "chunk_count": chunk_count,
                "has_document": False
            }
        
    except Exception as e:
        logger.error(f"Error getting document status: {e}", exc_info=True)
        raise
