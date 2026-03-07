"""
RAG embedder utilities for embedding text and storing vectors in Firestore.
Uses Gemini Embedding API: model="gemini-embedding-001".
"""

import os
import logging
import math
from typing import List, Dict
from google import genai
from google.cloud import firestore
import asyncio


logger = logging.getLogger(__name__)


def embed_text(text: str) -> List[float]:
    """
    Embed text using Gemini Embedding API.
    
    Args:
        text: Input text to embed
    
    Returns:
        List[float]: Vector embedding (768 dimensions)
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Call Gemini Embedding API using gemini-embedding-001.
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        
        # Extract embedding vector
        embedding = result.embeddings[0].values
        
        logger.debug(f"Embedded text ({len(text)} chars) → vector dim={len(embedding)}")
        
        return embedding
        
    except Exception as e:
        logger.error(f"Error embedding text: {e}", exc_info=True)
        raise


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Compute cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
    
    Returns:
        float: Similarity score (0-1, where 1 is most similar)
    """
    try:
        # Ensure vectors have the same dimension.
        if len(vec1) != len(vec2):
            raise ValueError(f"Vectors must have same dimension: {len(vec1)} vs {len(vec2)}")
        
        # Compute dot product.
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        
        # Compute magnitude of each vector.
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        
        # Avoid division by zero.
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        # Cosine similarity = dot_product / (mag1 * mag2)
        similarity = dot_product / (magnitude1 * magnitude2)
        
        return similarity
        
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {e}", exc_info=True)
        raise


async def embed_and_store_chunks(
    chunks: List[Dict],
    artifact_id: str,
    project_id: str = "museai-2026"
):
    """
    Embed each chunk and store it in Firestore "exhibit_chunks" and legacy "artifact_chunks".
    
    Args:
        chunks: List of chunks from chunker
        artifact_id: Artifact ID
        project_id: GCP project ID
    """
    try:
        logger.info(f"Embedding and storing {len(chunks)} chunks for artifact: {artifact_id}")
        
        # Initialize Firestore client.
        db = firestore.AsyncClient(project=project_id)
        
        # Target collections for chunk storage.
        chunks_collection = db.collection("exhibit_chunks")
        legacy_chunks_collection = db.collection("artifact_chunks")
        
        # Embed and store each chunk.
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)}: {chunk['id']}")
            
            # Embed content
            embedding = embed_text(chunk["content"])
            
            # Prepare document payload.
            doc_data = {
                "exhibit_id": artifact_id,
                "artifact_id": artifact_id,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "word_count": chunk["word_count"],
                "embedding": embedding,
                "created_at": firestore.SERVER_TIMESTAMP
            }
            
            # Store in Firestore with ID = chunk["id"].
            doc_ref = chunks_collection.document(chunk["id"])
            await doc_ref.set(doc_data)
            legacy_doc_ref = legacy_chunks_collection.document(chunk["id"])
            await legacy_doc_ref.set(doc_data)
            
            logger.debug(f"Stored chunk {chunk['id']} with embedding dim={len(embedding)}")
        
        logger.info(f"Successfully embedded and stored {len(chunks)} chunks")
        
    except Exception as e:
        logger.error(f"Error embedding and storing chunks: {e}", exc_info=True)
        raise


def embed_and_store_chunks_sync(
    chunks: List[Dict],
    artifact_id: str,
    project_id: str = "museai-2026"
):
    """
    Sync wrapper for embed_and_store_chunks (for non-async contexts).
    
    Args:
        chunks: List of chunks
        artifact_id: Artifact ID
        project_id: GCP project ID
    """
    try:
        # Create an event loop if needed.
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Run async function.
        loop.run_until_complete(
            embed_and_store_chunks(chunks, artifact_id, project_id)
        )
        
    except Exception as e:
        logger.error(f"Error in sync wrapper: {e}", exc_info=True)
        raise
