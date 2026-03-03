"""
Test RAG Pipeline đơn giản - không cần reportlab.
Chỉ test embedding và similarity.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from rag.embedder import embed_text, cosine_similarity


def test_embedding():
    """Test embedding với Gemini API."""
    print("\n" + "="*60)
    print("🧪 TEST 1: GEMINI EMBEDDING API")
    print("="*60)
    
    text = "Bình gốm Lý triều được làm từ đất sét cao cấp."
    print(f"📝 Text: {text}")
    print(f"⏳ Đang gọi Gemini Embedding API...")
    
    try:
        vector = embed_text(text)
        
        print(f"✅ Embedding thành công!")
        print(f"   - Vector dimension: {len(vector)}")
        print(f"   - First 5 values: {vector[:5]}")
        print(f"   - Data type: {type(vector[0])}")
        
        # gemini-embedding-001 returns 3072 dimensions
        assert len(vector) == 3072, f"Expected 3072 dims, got {len(vector)}"
        print(f"✅ Vector dimension correct (3072)")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_similarity():
    """Test cosine similarity."""
    print("\n" + "="*60)
    print("🧪 TEST 2: COSINE SIMILARITY")
    print("="*60)
    
    # Test 1: Identical texts
    print("📝 Test 2a: Identical texts")
    text1 = "Bình gốm cao 25 centimeters"
    text2 = "Bình gốm cao 25 centimeters"
    
    print(f"   Text 1: {text1}")
    print(f"   Text 2: {text2}")
    print(f"⏳ Embedding...")
    
    try:
        vec1 = embed_text(text1)
        vec2 = embed_text(text2)
        
        similarity = cosine_similarity(vec1, vec2)
        print(f"✅ Similarity: {similarity:.4f}")
        
        assert 0.99 <= similarity <= 1.0, f"Expected ~1.0, got {similarity}"
        print(f"✅ Identical texts have high similarity (>0.99)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 2: Different texts
    print("\n📝 Test 2b: Different texts")
    text3 = "Tượng đồng thời Trần Hưng Đạo"
    
    print(f"   Text 1: {text1}")
    print(f"   Text 3: {text3}")
    print(f"⏳ Embedding...")
    
    try:
        vec3 = embed_text(text3)
        
        similarity2 = cosine_similarity(vec1, vec3)
        print(f"✅ Similarity: {similarity2:.4f}")
        
        assert similarity2 < similarity, "Different texts should have lower similarity"
        print(f"✅ Different texts have lower similarity ({similarity2:.4f} < {similarity:.4f})")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_semantic_search():
    """Test semantic search capability."""
    print("\n" + "="*60)
    print("🧪 TEST 3: SEMANTIC SEARCH")
    print("="*60)
    
    # Tạo một số documents giả về bình gốm
    documents = [
        "Bình gốm Lý triều có chiều cao 25 centimeters và đường kính 15 centimeters",
        "Men ngọc xanh là đặc trưng của gốm thời Lý, tạo nên vẻ đẹp lung linh",
        "Kỹ thuật nung gốm ở nhiệt độ 1200-1300 độ C trong 48 giờ",
        "Tượng đồng Trần Hưng Đạo cao 2 mét, được đúc năm 1980",
        "Tranh lụa vẽ cảnh đồng quê Việt Nam thế kỷ 18"
    ]
    
    # Câu hỏi
    question = "Bình gốm cao bao nhiêu?"
    
    print(f"📝 Question: {question}")
    print(f"📚 Documents: {len(documents)} docs")
    print(f"⏳ Embedding question và tìm kiếm...")
    
    try:
        # Embed question
        q_vec = embed_text(question)
        
        # Embed tất cả documents và tính similarity
        results = []
        for i, doc in enumerate(documents):
            doc_vec = embed_text(doc)
            similarity = cosine_similarity(q_vec, doc_vec)
            results.append({
                "doc": doc,
                "similarity": similarity,
                "index": i
            })
        
        # Sort by similarity
        results.sort(key=lambda x: x["similarity"], reverse=True)
        
        print(f"\n📊 Top 3 most relevant documents:")
        for i, r in enumerate(results[:3]):
            print(f"   {i+1}. [{r['similarity']:.4f}] {r['doc'][:60]}...")
        
        # Verify document 0 (about chiều cao) có similarity cao nhất
        top_doc = results[0]
        assert top_doc["index"] == 0, "Document về chiều cao phải relevant nhất"
        assert top_doc["similarity"] > 0.5, "Top document phải có similarity > 0.5"
        
        print(f"\n✅ Semantic search working correctly!")
        print(f"   Document về 'chiều cao 25cm' được ranked #1 (sim={top_doc['similarity']:.4f})")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("🚀 RAG PIPELINE TEST - SIMPLIFIED VERSION")
    print("="*60)
    
    results = []
    
    # Test 1: Embedding
    results.append(("Embedding API", test_embedding()))
    
    # Test 2: Similarity
    results.append(("Cosine Similarity", test_similarity()))
    
    # Test 3: Semantic Search
    results.append(("Semantic Search", test_semantic_search()))
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")
    
    all_passed = all(r[1] for r in results)
    
    print("\n" + "="*60)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
    else:
        print("⚠️  SOME TESTS FAILED")
    print("="*60 + "\n")
    
    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
