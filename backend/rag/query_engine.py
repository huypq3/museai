"""
RAG Query Engine - Tìm chunks tương tự và trả lời câu hỏi với grounding.
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
    artifact_id: str,
    top_k: int = 5,
    project_id: str = "museai-2026"
) -> List[Dict]:
    """
    Tìm top K chunks tương tự nhất với câu hỏi.
    
    Args:
        question: Câu hỏi của user
        artifact_id: ID của artifact
        top_k: Số chunks trả về
        project_id: GCP project ID
    
    Returns:
        List[Dict]: Top K chunks với similarity score, format:
            - content: nội dung chunk
            - chunk_index: thứ tự chunk
            - similarity_score: điểm tương đồng (0-1)
    """
    try:
        logger.info(f"Searching similar chunks for question: {question[:50]}...")
        
        # Embed câu hỏi
        question_vector = embed_text(question)
        
        # Khởi tạo Firestore client
        db = firestore.AsyncClient(project=project_id)
        
        # Lấy tất cả chunks của artifact
        chunks_ref = db.collection("artifact_chunks").where("artifact_id", "==", artifact_id)
        chunks_docs = await chunks_ref.get()
        
        if not chunks_docs:
            logger.warning(f"No chunks found for artifact: {artifact_id}")
            return []
        
        logger.info(f"Found {len(chunks_docs)} chunks for artifact: {artifact_id}")
        
        # Tính similarity cho từng chunk
        chunks_with_similarity = []
        for doc in chunks_docs:
            chunk_data = doc.to_dict()
            chunk_embedding = chunk_data.get("embedding")
            
            if not chunk_embedding:
                logger.warning(f"Chunk {doc.id} has no embedding, skipping")
                continue
            
            # Tính cosine similarity
            similarity = cosine_similarity(question_vector, chunk_embedding)
            
            chunks_with_similarity.append({
                "content": chunk_data.get("content"),
                "chunk_index": chunk_data.get("chunk_index"),
                "similarity_score": similarity
            })
        
        # Sort theo similarity giảm dần
        chunks_with_similarity.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        # Lấy top K
        top_chunks = chunks_with_similarity[:top_k]
        
        logger.info(f"Top {len(top_chunks)} chunks with similarity: {[c['similarity_score'] for c in top_chunks]}")
        
        return top_chunks
        
    except Exception as e:
        logger.error(f"Error searching similar chunks: {e}", exc_info=True)
        raise


async def answer_with_rag(
    question: str,
    artifact_id: str,
    language: str = "vi",
    project_id: str = "museai-2026"
) -> Dict:
    """
    Trả lời câu hỏi với RAG grounding.
    
    Args:
        question: Câu hỏi của user
        artifact_id: ID của artifact
        language: Ngôn ngữ trả lời (vi, en, fr, zh, ja, ko)
        project_id: GCP project ID
    
    Returns:
        Dict:
            - answer: câu trả lời
            - sources: list chunks được dùng với similarity score
            - grounded: True nếu dùng tài liệu, False nếu dùng kiến thức chung
    """
    try:
        logger.info(f"Answering question with RAG: {question}")
        
        # Tìm chunks tương tự
        similar_chunks = await search_similar_chunks(
            question=question,
            artifact_id=artifact_id,
            top_k=5,
            project_id=project_id
        )
        
        # Kiểm tra xem có chunks đủ relevant không
        min_similarity_threshold = 0.3
        relevant_chunks = [
            c for c in similar_chunks
            if c["similarity_score"] >= min_similarity_threshold
        ]
        
        # Khởi tạo Gemini client
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        # Language instructions
        language_map = {
            "vi": "Trả lời bằng tiếng Việt.",
            "en": "Answer in English.",
            "fr": "Répondez en français.",
            "zh": "用中文回答。",
            "ja": "日本語で答えてください。",
            "ko": "한국어로 답변해 주세요."
        }
        language_instruction = language_map.get(language, language_map["vi"])
        
        # Nếu không có chunks relevant
        if not relevant_chunks:
            logger.info("No relevant chunks found, answering with general knowledge")
            
            prompt = f"""Bạn là hướng dẫn viên bảo tàng.
Câu hỏi: {question}

Tài liệu về hiện vật này không đề cập đến thông tin liên quan đến câu hỏi.
Hãy trả lời dựa trên kiến thức chung của bạn, và BẮT ĐẦU câu trả lời bằng:
"Theo kiến thức chung, ..."

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
        
        # Nếu có chunks relevant → dùng RAG
        logger.info(f"Found {len(relevant_chunks)} relevant chunks, using RAG")
        
        # Build context từ chunks
        context_parts = []
        for i, chunk in enumerate(relevant_chunks):
            context_parts.append(f"[Tài liệu {i+1}]\n{chunk['content']}\n")
        
        context = "\n".join(context_parts)
        
        # Build prompt với grounding
        prompt = f"""Bạn là hướng dẫn viên bảo tàng chuyên nghiệp.

TÀI LIỆU BẢO TÀNG:
{context}

CÂU HỎI:
{question}

HƯỚNG DẪN TRẢ LỜI:
1. Dựa CHÍNH vào tài liệu bảo tàng ở trên để trả lời
2. Nếu tài liệu không đề cập → nói rõ "Tài liệu không đề cập đến điều này"
3. KHÔNG bịa đặt thông tin không có trong tài liệu
4. Trả lời ngắn gọn, súc tích (2-3 câu)
5. {language_instruction}

Trả lời:
"""
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        answer = response.text
        
        # Prepare sources
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
