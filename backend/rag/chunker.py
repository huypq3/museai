"""
RAG chunker for splitting PDF text into overlapping chunks.
Uses PyMuPDF (fitz) for text extraction.
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
    Extract text from PDF and split it into overlapping chunks.
    
    Args:
        pdf_path: PDF file path
        artifact_id: Artifact ID in Firestore
        chunk_size: Number of words per chunk (default 512)
        overlap: Number of overlapping words between chunks (default 50)
    
    Returns:
        List[Dict]: List of chunks, each containing:
            - id: unique ID
            - artifact_id: Artifact ID
            - chunk_index: chunk order index (0, 1, 2...)
            - content: text content
            - word_count: number of words in chunk
    """
    try:
        logger.info(f"Extracting chunks from PDF: {pdf_path}")
        
        # Open PDF.
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        
        # Extract all text from all pages.
        full_text = ""
        for page in doc:  # Iterate directly over pages
            full_text += page.get_text()
        
        doc.close()
        
        # Split into words.
        words = full_text.split()
        total_words = len(words)
        
        logger.info(f"Extracted {total_words} words from {page_count} pages")
        
        if total_words == 0:
            logger.warning(f"No text extracted from PDF: {pdf_path}")
            return []
        
        # Build chunks with overlap.
        chunks = []
        chunk_index = 0
        start_idx = 0
        
        while start_idx < total_words:
            # Take chunk_size words.
            end_idx = min(start_idx + chunk_size, total_words)
            chunk_words = words[start_idx:end_idx]
            chunk_content = " ".join(chunk_words)
            
            # Build chunk dict.
            chunk = {
                "id": f"{artifact_id}_chunk_{chunk_index}",
                "artifact_id": artifact_id,
                "chunk_index": chunk_index,
                "content": chunk_content,
                "word_count": len(chunk_words)
            }
            
            chunks.append(chunk)
            
            # Move cursor with overlap.
            # Stop when this is the final chunk.
            if end_idx >= total_words:
                break
            
            # Move start_idx by (chunk_size - overlap) words.
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
    Extract text from PDF bytes and split into chunks.
    Used by upload API (without writing a temp file).
    
    Args:
        pdf_bytes: PDF bytes content
        artifact_id: Artifact ID
        chunk_size: Number of words per chunk
        overlap: Number of overlapping words
    
    Returns:
        List[Dict]: List of chunks
    """
    try:
        logger.info(f"Extracting chunks from PDF bytes for artifact: {artifact_id}")
        
        # Open PDF from bytes.
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        
        # Extract text from all pages.
        full_text = ""
        for page in doc:  # Iterate directly over pages
            full_text += page.get_text()
        
        doc.close()
        
        # Split into words.
        words = full_text.split()
        total_words = len(words)
        
        logger.info(f"Extracted {total_words} words from {page_count} pages")
        
        if total_words == 0:
            logger.warning(f"No text extracted from PDF bytes for artifact: {artifact_id}")
            return []
        
        # Build chunks with overlap.
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
