"""
RAG Chunker - Tách PDF thành chunks để embedding.
Dùng PyMuPDF (fitz) để extract text từ PDF.
"""

import fitz  # PyMuPDF
import logging
from typing import List, Dict
import uuid


logger = logging.getLogger(__name__)


def extract_chunks(
    pdf_path: str,
    artifact_id: str,
    chunk_size: int = 512,
    overlap: int = 50
) -> List[Dict]:
    """
    Extract text từ PDF và tách thành chunks với overlap.
    
    Args:
        pdf_path: Đường dẫn đến file PDF
        artifact_id: ID của artifact trong Firestore
        chunk_size: Số words mỗi chunk (mặc định 512)
        overlap: Số words overlap giữa các chunks (mặc định 50)
    
    Returns:
        List[Dict]: Danh sách chunks, mỗi chunk có:
            - id: unique ID
            - artifact_id: ID của artifact
            - chunk_index: thứ tự chunk (0, 1, 2...)
            - content: nội dung text
            - word_count: số words trong chunk
    """
    try:
        logger.info(f"Extracting chunks from PDF: {pdf_path}")
        
        # Mở PDF
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        
        # Extract toàn bộ text từ tất cả pages
        full_text = ""
        for page in doc:  # Iterate directly over pages
            full_text += page.get_text()
        
        doc.close()
        
        # Tách thành words
        words = full_text.split()
        total_words = len(words)
        
        logger.info(f"Extracted {total_words} words from {page_count} pages")
        
        if total_words == 0:
            logger.warning(f"No text extracted from PDF: {pdf_path}")
            return []
        
        # Tạo chunks với overlap
        chunks = []
        chunk_index = 0
        start_idx = 0
        
        while start_idx < total_words:
            # Lấy chunk_size words
            end_idx = min(start_idx + chunk_size, total_words)
            chunk_words = words[start_idx:end_idx]
            chunk_content = " ".join(chunk_words)
            
            # Tạo chunk dict
            chunk = {
                "id": f"{artifact_id}_chunk_{chunk_index}",
                "artifact_id": artifact_id,
                "chunk_index": chunk_index,
                "content": chunk_content,
                "word_count": len(chunk_words)
            }
            
            chunks.append(chunk)
            
            # Di chuyển con trỏ với overlap
            # Nếu đây là chunk cuối → dừng
            if end_idx >= total_words:
                break
            
            # Di chuyển start_idx: bỏ qua (chunk_size - overlap) words
            start_idx += (chunk_size - overlap)
            chunk_index += 1
        
        logger.info(f"Created {len(chunks)} chunks from PDF")
        
        return chunks
        
    except Exception as e:
        logger.error(f"Error extracting chunks from PDF {pdf_path}: {e}", exc_info=True)
        raise


def extract_chunks_from_bytes(
    pdf_bytes: bytes,
    artifact_id: str,
    chunk_size: int = 512,
    overlap: int = 50
) -> List[Dict]:
    """
    Extract text từ PDF bytes và tách thành chunks.
    Dùng cho upload API (không cần save file tạm).
    
    Args:
        pdf_bytes: PDF file content dạng bytes
        artifact_id: ID của artifact
        chunk_size: Số words mỗi chunk
        overlap: Số words overlap
    
    Returns:
        List[Dict]: Danh sách chunks
    """
    try:
        logger.info(f"Extracting chunks from PDF bytes for artifact: {artifact_id}")
        
        # Mở PDF từ bytes
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        
        # Extract text từ tất cả pages
        full_text = ""
        for page in doc:  # Iterate directly over pages
            full_text += page.get_text()
        
        doc.close()
        
        # Tách thành words
        words = full_text.split()
        total_words = len(words)
        
        logger.info(f"Extracted {total_words} words from {page_count} pages")
        
        if total_words == 0:
            logger.warning(f"No text extracted from PDF bytes for artifact: {artifact_id}")
            return []
        
        # Tạo chunks với overlap
        chunks = []
        chunk_index = 0
        start_idx = 0
        
        while start_idx < total_words:
            end_idx = min(start_idx + chunk_size, total_words)
            chunk_words = words[start_idx:end_idx]
            chunk_content = " ".join(chunk_words)
            
            chunk = {
                "id": f"{artifact_id}_chunk_{chunk_index}",
                "artifact_id": artifact_id,
                "chunk_index": chunk_index,
                "content": chunk_content,
                "word_count": len(chunk_words)
            }
            
            chunks.append(chunk)
            
            if end_idx >= total_words:
                break
            
            start_idx += (chunk_size - overlap)
            chunk_index += 1
        
        logger.info(f"Created {len(chunks)} chunks from PDF bytes")
        
        return chunks
        
    except Exception as e:
        logger.error(f"Error extracting chunks from PDF bytes: {e}", exc_info=True)
        raise
