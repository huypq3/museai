from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from rag import query_engine
from rag.embedder import cosine_similarity


def test_cosine_similarity_identical_vectors():
    vec = [1.0, 2.0, 3.0]
    assert cosine_similarity(vec, vec) == pytest.approx(1.0)


def test_cosine_similarity_zero_vector():
    assert cosine_similarity([0.0, 0.0], [1.0, 2.0]) == 0.0


@pytest.mark.asyncio
async def test_answer_with_rag_grounded(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(
        query_engine,
        "search_similar_chunks",
        AsyncMock(
            return_value=[
                {"content": "Height is 25cm", "chunk_index": 1, "similarity_score": 0.91},
                {"content": "Made in Ly era", "chunk_index": 2, "similarity_score": 0.61},
            ]
        ),
    )

    class _FakeModels:
        @staticmethod
        def generate_content(*args, **kwargs):
            return SimpleNamespace(text="The vase is 25cm tall.")

    class _FakeClient:
        def __init__(self, api_key: str):
            self.api_key = api_key
            self.models = _FakeModels()

    monkeypatch.setattr(query_engine.genai, "Client", _FakeClient)

    result = await query_engine.answer_with_rag("How tall is it?", "exhibit_1", language="en")

    assert result["grounded"] is True
    assert len(result["sources"]) == 2
    assert result["answer"]


@pytest.mark.asyncio
async def test_answer_with_rag_falls_back_to_general_knowledge(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(query_engine, "search_similar_chunks", AsyncMock(return_value=[]))

    class _FakeModels:
        @staticmethod
        def generate_content(*args, **kwargs):
            return SimpleNamespace(text="Based on general knowledge, this style is common in East Asia.")

    class _FakeClient:
        def __init__(self, api_key: str):
            self.api_key = api_key
            self.models = _FakeModels()

    monkeypatch.setattr(query_engine.genai, "Client", _FakeClient)

    result = await query_engine.answer_with_rag("Tell me background", "exhibit_1", language="en")

    assert result["grounded"] is False
    assert result["sources"] == []
    assert "Based on general knowledge" in result["answer"]
