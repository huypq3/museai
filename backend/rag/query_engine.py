"""
RAG query engine for similarity search and grounded question answering.
"""

import os
import logging
from typing import List, Dict
from google import genai
from google.cloud import firestore

from rag.embedder import embed_text, cosine_similarity


logger = logging.getLogger(__name__)


async def search_similar_chunks(
    question: str,
    exhibit_id: str,
    top_k: int = 5,
    project_id: str = "museai-2026"
) -> List[Dict]:
    """
    Find top-K chunks most similar to the question.
    
    Args:
        question: User question
        exhibit_id: Exhibit ID
        top_k: Number of chunks to return
        project_id: GCP project ID
    
    Returns:
        List[Dict]: Top-K chunks with similarity score:
            - content: chunk content
            - chunk_index: chunk index
            - similarity_score: similarity score (0-1)
    """
    try:
        logger.info(f"Searching similar chunks for question: {question[:50]}...")
        
        # Embed question.
        question_vector = embed_text(question)
        
        # Initialize Firestore client.
        db = firestore.AsyncClient(project=project_id)
        
        # Fetch all chunks for exhibit (fallback to legacy exhibit_chunks).
        chunks_ref = db.collection("exhibit_chunks").where("exhibit_id", "==", exhibit_id)
        chunks_docs = await chunks_ref.get()
        if not chunks_docs:
            chunks_ref = db.collection("exhibit_chunks").where("exhibit_id", "==", exhibit_id)
            chunks_docs = await chunks_ref.get()
        
        if not chunks_docs:
            logger.warning(f"No chunks found for exhibit: {exhibit_id}")
            return []
        
        logger.info(f"Found {len(chunks_docs)} chunks for exhibit: {exhibit_id}")
        
        # Compute similarity for each chunk.
        chunks_with_similarity = []
        for doc in chunks_docs:
            chunk_data = doc.to_dict()
            chunk_embedding = chunk_data.get("embedding")
            
            if not chunk_embedding:
                logger.warning(f"Chunk {doc.id} has no embedding, skipping")
                continue
            
            # Compute cosine similarity.
            similarity = cosine_similarity(question_vector, chunk_embedding)
            
            chunks_with_similarity.append({
                "content": chunk_data.get("content"),
                "chunk_index": chunk_data.get("chunk_index"),
                "similarity_score": similarity
            })
        
        # Sort by descending similarity.
        chunks_with_similarity.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        # Keep top K.
        top_chunks = chunks_with_similarity[:top_k]
        
        logger.info(f"Top {len(top_chunks)} chunks with similarity: {[c['similarity_score'] for c in top_chunks]}")
        
        return top_chunks
        
    except Exception as e:
        logger.error(f"Error searching similar chunks: {e}", exc_info=True)
        raise


async def answer_with_rag(
    question: str,
    exhibit_id: str,
    language: str = "vi",
    project_id: str = "museai-2026"
) -> Dict:
    """
    Answer questions with RAG grounding.
    
    Args:
        question: User question
        exhibit_id: Exhibit ID
        language: Output language (vi, en, de, ru, ar, es, fr, zh, ja, ko)
        project_id: GCP project ID
    
    Returns:
        Dict:
            - answer: generated answer
            - sources: list of used chunks with similarity score
            - grounded: True if grounded in docs, False if using general knowledge
    """
    try:
        logger.info(f"Answering question with RAG: {question}")
        
        # Retrieve similar chunks.
        similar_chunks = await search_similar_chunks(
            question=question,
            exhibit_id=exhibit_id,
            top_k=5,
            project_id=project_id
        )
        
        # Filter by relevance threshold.
        min_similarity_threshold = 0.3
        relevant_chunks = [
            c for c in similar_chunks
            if c["similarity_score"] >= min_similarity_threshold
        ]
        
        # Initialize Gemini client.
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Language instruction map.
        language_map = {
            "vi": "Respond in Vietnamese.",
            "en": "Respond in English.",
            "de": "Respond in German.",
            "ru": "Respond in Russian.",
            "ar": "Respond in Arabic.",
            "es": "Respond in Spanish.",
            "fr": "Respond in French.",
            "zh": "Respond in Chinese.",
            "ja": "Respond in Japanese.",
            "ko": "Respond in Korean.",
        }
        language_instruction = language_map.get(language, language_map["vi"])
        
        # If no relevant chunks are found.
        if not relevant_chunks:
            logger.info("No relevant chunks found, answering with general knowledge")
            
            prompt = f"""You are a museum guide.
Question: {question}

The exhibit documents do not contain relevant details for this question.
Answer using your general knowledge, and START your answer with:
"Based on general knowledge, ..."

{language_instruction}
"""
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            
            answer = response.text
            
            return {
                "answer": answer,
                "sources": [],
                "grounded": False
            }
        
        # If relevant chunks are available, use grounded RAG flow.
        logger.info(f"Found {len(relevant_chunks)} relevant chunks, using RAG")
        
        # Build context from selected chunks.
        context_parts = []
        for i, chunk in enumerate(relevant_chunks):
            context_parts.append(f"[Document {i+1}]\n{chunk['content']}\n")
        
        context = "\n".join(context_parts)
        
        # Build grounded answer prompt.
        prompt = f"""You are a professional museum guide.

MUSEUM DOCUMENTS:
{context}

QUESTION:
{question}

ANSWER RULES:
1. Base your answer primarily on the museum documents above.
2. If the documents do not mention the detail, explicitly say:
   "The museum documents do not mention this detail."
3. Do not invent facts that are not present in the documents.
4. Keep the response concise (2-3 sentences).
5. {language_instruction}

Answer:
"""
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        answer = response.text
        
        # Prepare source list for response.
        sources = [
            {
                "chunk_index": chunk["chunk_index"],
                "similarity": round(chunk["similarity_score"], 3)
            }
            for chunk in relevant_chunks
        ]
        
        return {
            "answer": answer,
            "sources": sources,
            "grounded": True
        }
        
    except Exception as e:
        logger.error(f"Error answering with RAG: {e}", exc_info=True)
        raise
