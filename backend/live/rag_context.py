"""
RAG context utilities for voice live sessions.
Loads artifact knowledge_base from Firestore and provides semantic search.
"""

from __future__ import annotations

import os
import logging
from typing import Any

import numpy as np
from google.cloud import firestore

logger = logging.getLogger(__name__)

_db: firestore.AsyncClient | None = None
_embedding_model = None


def _get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026")
        _db = firestore.AsyncClient(project=project_id)
    return _db


def _get_embedding_model():
    """
    Lazy-load Vertex embedding model to avoid startup failures on environments
    without Vertex initialization.
    """
    global _embedding_model
    if _embedding_model is None:
        from vertexai.language_models import TextEmbeddingModel

        _embedding_model = TextEmbeddingModel.from_pretrained("gemini-embedding-001")
    return _embedding_model


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


async def get_artifact_name(artifact_id: str) -> str:
    db = _get_db()
    doc = await db.collection("exhibits").document(artifact_id).get()
    if not doc.exists:
        doc = await db.collection("artifacts").document(artifact_id).get()
    if not doc.exists:
        return artifact_id
    data = doc.to_dict() or {}
    return data.get("name") or artifact_id


async def get_museum_prompt_config(museum_id: str) -> dict[str, Any]:
    """
    Load museum-level prompt configuration used by live voice.
    Returns:
      {
        "ai_persona": str,
        "welcome_message": dict[str, str]
      }
    """
    if not museum_id:
        return {"ai_persona": "", "welcome_message": {}}

    doc = await _get_db().collection("museums").document(museum_id).get()
    if not doc.exists:
        return {"ai_persona": "", "welcome_message": {}}

    data = doc.to_dict() or {}
    return {
        "ai_persona": str(data.get("ai_persona", "") or ""),
        "welcome_message": data.get("welcome_message", {}) or {},
    }


async def get_artifact_context(artifact_id: str, top_k: int = 8) -> str:
    """
    Load knowledge chunks for artifact and format as plain-text context.
    """
    db = _get_db()
    doc = await db.collection("exhibits").document(artifact_id).get()
    if not doc.exists:
        doc = await db.collection("artifacts").document(artifact_id).get()
    if not doc.exists:
        return ""

    data = doc.to_dict() or {}
    chunks = data.get("knowledge_base", []) or []
    if not chunks:
        return ""

    parts: list[str] = []
    for chunk in chunks[:top_k]:
        category = str(chunk.get("category", "other")).upper()
        content = str(chunk.get("content", "")).strip()
        if not content:
            continue
        parts.append(f"[{category}]\n{content}")
    return "\n\n".join(parts)


def _embed_query(query: str) -> list[float]:
    model = _get_embedding_model()
    emb = model.get_embeddings([query])[0]
    return list(emb.values)


async def semantic_search(artifact_id: str, query: str, top_k: int = 3) -> str:
    """
    Semantic search from artifact.knowledge_base embeddings.
    """
    if not query.strip():
        return ""

    db = _get_db()
    doc = await db.collection("exhibits").document(artifact_id).get()
    if not doc.exists:
        doc = await db.collection("artifacts").document(artifact_id).get()
    if not doc.exists:
        return ""

    chunks = (doc.to_dict() or {}).get("knowledge_base", []) or []
    if not chunks:
        return ""

    query_embedding = _embed_query(query)
    scored: list[tuple[float, dict[str, Any]]] = []
    for chunk in chunks:
        emb = chunk.get("embedding")
        if not emb:
            continue
        try:
            score = cosine_similarity(query_embedding, emb)
        except Exception:
            continue
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = [chunk for _, chunk in scored[:top_k]]
    return "\n\n".join(
        f"[{str(c.get('category', 'other')).upper()}]\n{str(c.get('content', '')).strip()}"
        for c in top_chunks
        if str(c.get("content", "")).strip()
    )


def add_embeddings_to_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Mutates and returns chunks with `embedding` field using gemini-embedding-001.
    """
    if not chunks:
        return chunks
    model = _get_embedding_model()
    for chunk in chunks:
        content = str(chunk.get("content", "")).strip()
        if not content:
            chunk["embedding"] = []
            continue
        emb = model.get_embeddings([content])[0]
        chunk["embedding"] = list(emb.values)
    return chunks
