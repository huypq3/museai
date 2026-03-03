# Sprint 2 - RAG Pipeline ✅

## 📦 Code đã viết hoàn chỉnh

### 1. RAG Core Modules

- **backend/rag/chunker.py** (164 dòng)
  - Extract text từ PDF bằng PyMuPDF
  - Tách thành chunks 512 words với overlap 50 words
  - Support cả file path và bytes stream

- **backend/rag/embedder.py** (162 dòng)
  - Gemini Embedding API: `text-embedding-004` (768 dimensions)
  - Cosine similarity calculation
  - Store embeddings vào Firestore collection `artifact_chunks`

- **backend/rag/query_engine.py** (183 dòng)
  - Semantic search với similarity threshold 0.3
  - RAG-grounded answers với source citations
  - Fallback to general knowledge nếu không có relevant chunks

### 2. CMS Upload Module

- **backend/cms/upload.py** (134 dòng)
  - Upload PDF → Cloud Storage (`gs://museai-documents`)
  - Extract → Embed → Store chunks
  - Document status tracking

### 3. API Endpoints

**Updated backend/main.py** với 3 endpoints mới:

- `POST /admin/upload-pdf/{artifact_id}` - Upload PDF document
- `GET /admin/document-status/{artifact_id}` - Check document status
- `POST /qa/{artifact_id}` - Q&A with RAG grounding

### 4. Tests

- **tests/test_rag.py** (296 dòng) - Full test suite với reportlab
- **tests/test_rag_simple.py** (169 dòng) - Simplified tests (không cần reportlab)

## 🚀 Cách chạy

### Server đang chạy
```bash
# Server: http://127.0.0.1:8080
# Endpoints: 
#   - POST /admin/upload-pdf/{artifact_id}
#   - GET /admin/document-status/{artifact_id}
#   - POST /qa/{artifact_id}
```

### Test RAG Pipeline

**Option 1: Chạy với API key có sẵn**
```bash
cd /Users/admin/Desktop/guideQR.ai/museai

# Set API key
export GEMINI_API_KEY='your-api-key-here'

# Run tests
./run_rag_tests.sh
```

**Option 2: Get API key từ Secret Manager**
```bash
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=museai-2026)

./run_rag_tests.sh
```

### Test với pytest (full test suite)
```bash
cd /Users/admin/Desktop/guideQR.ai/museai
source .venv/bin/activate

export GEMINI_API_KEY='your-api-key-here'
export GOOGLE_CLOUD_PROJECT=museai-2026
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/museai-sa-key.json

python -m pytest tests/test_rag.py -v -s
```

## 📊 Test Coverage

### Test 1: Embedding API
- Verify Gemini embedding returns 768-dim vector
- Check data types and format

### Test 2: Cosine Similarity
- Identical texts → similarity ~1.0
- Different texts → lower similarity

### Test 3: Semantic Search
- Query "Bình gốm cao bao nhiêu?"
- Verify relevant document ranked #1
- Verify similarity scores

### Test 4: Full Pipeline (test_rag.py only)
- Create test PDF with artifact info
- Upload → Chunk → Embed → Store
- Query with RAG
- Verify answer contains correct info
- Verify grounding status

## 🔧 Dependencies đã thêm

```txt
pymupdf==1.24.0      # PDF extraction
reportlab==4.0.0     # PDF generation (for tests)
numpy==1.26.0        # Vector operations
```

**Note**: reportlab requires Cairo system library:
```bash
brew install cairo pkg-config
```

## 📝 Firestore Collections

### artifact_chunks
```javascript
{
  id: "artifact_id_chunk_0",
  artifact_id: "statue_tran_hung_dao",
  chunk_index: 0,
  content: "Full text content...",
  word_count: 512,
  embedding: [0.123, 0.456, ...], // 768 floats
  created_at: timestamp
}
```

### documents
```javascript
{
  artifact_id: "statue_tran_hung_dao",
  filename: "tran_hung_dao_info.pdf",
  gcs_path: "gs://museai-documents/statue_tran_hung_dao/original.pdf",
  chunk_count: 15,
  uploaded_at: timestamp
}
```

## 🎯 Next Steps

1. ✅ **Test basic functionality**
   ```bash
   export GEMINI_API_KEY='your-key'
   ./run_rag_tests.sh
   ```

2. **Upload sample PDF**
   ```bash
   curl -X POST http://localhost:8080/admin/upload-pdf/test_artifact \
     -F "file=@sample.pdf"
   ```

3. **Test Q&A endpoint**
   ```bash
   curl -X POST http://localhost:8080/qa/test_artifact \
     -H "Content-Type: application/json" \
     -d '{"question": "Thông tin về hiện vật này?", "language": "vi"}'
   ```

4. **Check document status**
   ```bash
   curl http://localhost:8080/admin/document-status/test_artifact
   ```

## 🐛 Known Issues

- ❌ Firestore queries có thể chậm lần đầu (cold start)
- ⚠️  `gcloud secrets access` cần permissions đúng
- ⚠️  reportlab cần Cairo system library

## ✅ Sprint 2 Status

**CODE: HOÀN THÀNH 100%**
- ✅ Chunker
- ✅ Embedder  
- ✅ Query Engine
- ✅ Upload handler
- ✅ API endpoints
- ✅ Tests

**TESTING: CẦN GEMINI_API_KEY**
- ⏳ Set API key và chạy `./run_rag_tests.sh`
- ⏳ Upload sample PDF để test full pipeline
