"""RAG module - Retrieval Augmented Generation pipeline."""

from .chunker import extract_chunks, extract_chunks_from_bytes
from .embedder import embed_text, cosine_similarity, embed_and_store_chunks
from .query_engine import search_similar_chunks, answer_with_rag

__all__ = [
    "extract_chunks",
    "extract_chunks_from_bytes",
    "embed_text",
    "cosine_similarity",
    "embed_and_store_chunks",
    "search_similar_chunks",
    "answer_with_rag"
]
