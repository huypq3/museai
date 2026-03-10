"""
Integration tests for semantic similarity using real Gemini embedding API.
"""

from pathlib import Path
import sys
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from rag.embedder import embed_text, cosine_similarity

pytestmark = pytest.mark.integration


def test_embedding_shape():
    vector = embed_text("Binh gom Ly trieu duoc lam tu dat set.")
    assert isinstance(vector, list)
    assert len(vector) >= 256
    assert isinstance(vector[0], float)


def test_semantic_similarity_ordering():
    q = "Binh gom cao bao nhieu?"
    related = "Binh gom Ly trieu co chieu cao 25 cm."
    unrelated = "Tranh lua ve canh dong que Viet Nam."

    q_vec = embed_text(q)
    related_vec = embed_text(related)
    unrelated_vec = embed_text(unrelated)

    sim_related = cosine_similarity(q_vec, related_vec)
    sim_unrelated = cosine_similarity(q_vec, unrelated_vec)

    assert sim_related > sim_unrelated
