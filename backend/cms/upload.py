"""
CMS upload utilities for PDF ingestion and RAG chunk creation.
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
    Upload PDF to Cloud Storage and generate RAG chunks.
    
    Args:
        file_bytes: PDF file content
        filename: Original filename
        artifact_id: Artifact ID
        project_id: GCP project ID
        bucket_name: Cloud Storage bucket name
    
    Returns:
        Dict:
            - artifact_id: Artifact ID
            - chunk_count: Number of generated chunks
            - status: "success" or "error"
            - gcs_path: File path in GCS
    """
    try:
        logger.info(f"Uploading PDF for artifact: {artifact_id}")
        
        # 1) Upload PDF to Cloud Storage
        storage_client = storage.Client(project=project_id)
        bucket = storage_client.bucket(bucket_name)
        
        # Path: {artifact_id}/original.pdf
        blob_path = f"{artifact_id}/original.pdf"
        blob = bucket.blob(blob_path)
        
        # Upload
        blob.upload_from_string(file_bytes, content_type="application/pdf")
        gcs_path = f"gs://{bucket_name}/{blob_path}"
        
        logger.info(f"Uploaded PDF to: {gcs_path}")
        
        # 2) Extract chunks from PDF bytes
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
        
        # 3) Embed and store chunks in Firestore
        await embed_and_store_chunks(
            chunks=chunks,
            artifact_id=artifact_id,
            project_id=project_id
        )
        
        # 4) Store metadata in Firestore "documents" collection
        db = firestore.AsyncClient(project=project_id)
        doc_ref = db.collection("documents").document(artifact_id)
        
        await doc_ref.set({
            "exhibit_id": artifact_id,
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
    Check document status for an artifact.
    
    Args:
        artifact_id: Artifact ID
        project_id: GCP project ID
    
    Returns:
        Dict:
            - artifact_id: Artifact ID
            - chunk_count: Number of current chunks
            - has_document: True if document exists
            - document_info: Document metadata (if present)
    """
    try:
        logger.info(f"Getting document status for artifact: {artifact_id}")
        
        db = firestore.AsyncClient(project=project_id)
        
        # Check document metadata
        doc_ref = db.collection("documents").document(artifact_id)
        doc_snapshot = await doc_ref.get()
        
        # Count chunks
        chunks_ref = db.collection("exhibit_chunks").where("exhibit_id", "==", artifact_id)
        chunks_docs = await chunks_ref.get()
        if not chunks_docs:
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
