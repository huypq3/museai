"""
Tests cho RAG Pipeline - Sprint 2
"""

import pytest
import os
import sys
import asyncio
from io import BytesIO
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

pytestmark = pytest.mark.integration

from rag.embedder import embed_text, cosine_similarity
from rag.chunker import extract_chunks_from_bytes
from cms.upload import upload_pdf
from rag.query_engine import answer_with_rag


def test_embed_text():
    """Test embedding text với Gemini API."""
    print("\n🧪 Test 1: Embedding text...")
    
    # Embed một câu tiếng Việt
    text = "Bình gốm Lý triều được làm từ đất sét và nung ở nhiệt độ cao."
    vector = embed_text(text)
    
    # Verify vector shape is non-trivial (dimension depends on embedding model).
    assert isinstance(vector, list), "Vector phải là list"
    assert len(vector) >= 256, f"Embedding dimension quá nhỏ: {len(vector)}"
    assert all(isinstance(v, float) for v in vector), "Tất cả elements phải là float"
    
    print(f"✅ Embedded text ({len(text)} chars) → vector dim={len(vector)}")


def test_cosine_similarity():
    """Test tính cosine similarity."""
    print("\n🧪 Test 2: Cosine similarity...")
    
    # Embed 2 câu giống nhau
    text1 = "Bình gốm Lý triều cao 25cm"
    text2 = "Bình gốm Lý triều cao 25cm"
    
    vec1 = embed_text(text1)
    vec2 = embed_text(text2)
    
    similarity = cosine_similarity(vec1, vec2)
    
    # Similarity của 2 vector giống nhau phải gần 1.0
    assert 0.99 <= similarity <= 1.0, f"Expected similarity ~1.0, got {similarity}"
    
    print(f"✅ Similarity giữa 2 câu giống nhau: {similarity:.4f}")
    
    # Test với 2 câu khác nhau
    text3 = "Tượng đồng thời Trần"
    vec3 = embed_text(text3)
    
    similarity2 = cosine_similarity(vec1, vec3)
    
    # Similarity phải thấp hơn
    assert similarity2 < 0.9, f"Expected lower similarity, got {similarity2}"
    
    print(f"✅ Similarity giữa 2 câu khác nhau: {similarity2:.4f}")


def test_chunker():
    """Test chunker với PDF test."""
    print("\n🧪 Test 3: PDF Chunker...")
    
    # Tạo PDF test bằng reportlab
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    
    # Tạo PDF trong memory
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    
    # Viết content vào PDF
    text_content = """
    Bình gốm Lý triều
    
    Đây là một hiện vật quý giá từ thời nhà Lý (1010-1225).
    Bình gốm có chiều cao 25 centimeters và đường kính thân 15 centimeters.
    Men ngọc xanh đặc trưng của gốm Lý, có ánh lung linh.
    
    Kỹ thuật chế tác:
    Được làm từ đất sét tinh khiết, nung ở nhiệt độ 1200-1300 độ C.
    Thời gian nung khoảng 48 giờ trong lò rồng.
    Nghệ nhân dùng men tro thực vật để tạo màu xanh ngọc.
    
    Ý nghĩa lịch sử:
    Phản ánh trình độ cao của nghề gốm Việt Nam thời Lý.
    Bình được dùng trong cung đình để đựng rượu hoặc nước hoa.
    Tìm thấy tại di chỉ Thăng Long năm 2003.
    """
    
    y = 800
    for line in text_content.split('\n'):
        if line.strip():
            c.drawString(50, y, line.strip())
            y -= 20
            if y < 50:
                c.showPage()
                y = 800
    
    c.save()
    
    pdf_bytes = buffer.getvalue()
    
    # Extract chunks
    chunks = extract_chunks_from_bytes(
        pdf_bytes=pdf_bytes,
        exhibit_id="test_exhibit_001",
        chunk_size=50,  # Nhỏ hơn để test
        overlap=10
    )
    
    assert len(chunks) >= 1, "Phải có ít nhất 1 chunk"
    assert all("id" in c for c in chunks), "Mỗi chunk phải có ID"
    assert all("content" in c for c in chunks), "Mỗi chunk phải có content"
    assert all("chunk_index" in c for c in chunks), "Mỗi chunk phải có chunk_index"
    
    print(f"✅ Extracted {len(chunks)} chunks từ PDF test")
    print(f"   Chunk đầu tiên: {chunks[0]['content'][:80]}...")


@pytest.mark.asyncio
async def test_full_pipeline():
    """Test full RAG pipeline: upload → embed → query."""
    print("\n🧪 Test 4: Full RAG Pipeline...")
    
    # Tạo PDF test về bình gốm
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    
    content = """
    BÌNH GỐM LÝ TRIỀU - TÀI LIỆU BẢO TÀNG
    
    Thông tin cơ bản:
    - Tên: Bình gốm men ngọc Lý triều
    - Kích thước: Cao 25cm, đường kính thân 15cm, đường kính miệng 8cm
    - Niên đại: Thế kỷ 11-12, thời nhà Lý
    - Chất liệu: Gốm nung, men ngọc xanh
    - Xuất xứ: Phát hiện tại di chỉ Hoàng thành Thăng Long
    
    Mô tả chi tiết:
    Bình có dáng mảnh mai, cổ thon dài, thân phình, đáy hơi thu.
    Men ngọc xanh phủ đều khắp bề mặt, có ánh lung linh đặc trưng.
    Bề mặt trang trí hoa văn sen cách điệu ở phần vai bình.
    
    Kỹ thuật chế tác:
    Sử dụng đất sét tinh khiết từ làng gốm Bát Tràng.
    Nung ở nhiệt độ 1250 độ C trong lò rồng.
    Thời gian nung khoảng 48 giờ.
    Men được làm từ tro thực vật và khoáng chất tự nhiên.
    
    Giá trị:
    - Phản ánh đỉnh cao nghệ thuật gốm thời Lý
    - Chứng minh trình độ kỹ thuật cao của nghệ nhân Việt
    - Hiện vật quốc bảo, không được phép đem ra nước ngoài
    """
    
    y = 800
    for line in content.split('\n'):
        if line.strip():
            c.drawString(50, y, line.strip())
            y -= 15
            if y < 50:
                c.showPage()
                y = 800
    
    c.save()
    pdf_bytes = buffer.getvalue()
    
    exhibit_id = "test_binh_gom_ly"
    
    print(f"   📄 Tạo PDF test: {len(pdf_bytes)} bytes")
    
    # 1. Upload PDF và tạo chunks
    print("   ⏳ Đang upload và embed chunks...")
    result = await upload_pdf(
        file_bytes=pdf_bytes,
        filename="test_binh_gom.pdf",
        exhibit_id=exhibit_id
    )
    
    assert result["status"] == "success", f"Upload failed: {result}"
    assert result["chunk_count"] > 0, "Phải có ít nhất 1 chunk"
    
    print(f"   ✅ Upload thành công: {result['chunk_count']} chunks")
    
    # 2. Test Q&A với grounding
    print("   ⏳ Đang test Q&A với RAG...")
    
    # Câu hỏi về thông tin có trong PDF
    qa_result = await answer_with_rag(
        question="Bình gốm cao bao nhiêu centimeters?",
        exhibit_id=exhibit_id,
        language="vi"
    )
    
    assert "answer" in qa_result, "Phải có answer"
    assert "sources" in qa_result, "Phải có sources"
    assert "grounded" in qa_result, "Phải có grounded flag"
    
    answer = qa_result["answer"]
    grounded = qa_result["grounded"]
    
    print(f"   📝 Answer: {answer[:150]}...")
    print(f"   🔗 Grounded: {grounded}")
    print(f"   📚 Sources: {len(qa_result['sources'])} chunks")
    
    # Verify "25" có trong answer
    assert "25" in answer or "hai mươi lăm" in answer.lower(), \
        "Answer phải chứa thông tin về chiều cao 25cm"
    
    # Verify grounded = True
    assert grounded == True, "Câu trả lời phải được grounded bởi tài liệu"
    
    print(f"   ✅ Q&A test passed!")
    
    # 3. Test với câu hỏi không có trong tài liệu
    print("   ⏳ Test câu hỏi ngoài tài liệu...")
    
    qa_result2 = await answer_with_rag(
        question="Bình gốm có giá bao nhiêu tiền?",
        exhibit_id=exhibit_id,
        language="vi"
    )
    
    # Có thể grounded=False hoặc answer nói rõ không có thông tin
    print(f"   📝 Answer: {qa_result2['answer'][:150]}...")
    print(f"   🔗 Grounded: {qa_result2['grounded']}")
    
    print(f"\n✅ Full pipeline test PASSED!")


if __name__ == "__main__":
    print("=" * 60)
    print("RAG PIPELINE TESTS - SPRINT 2")
    print("=" * 60)
    
    # Test 1: Embedding
    test_embed_text()
    
    # Test 2: Similarity
    test_cosine_similarity()
    
    # Test 3: Chunker
    test_chunker()
    
    # Test 4: Full pipeline (async)
    asyncio.run(test_full_pipeline())
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
