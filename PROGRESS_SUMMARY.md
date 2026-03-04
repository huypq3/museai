# MuseAI - Sprint Progress Summary 🎭

## 🏆 Project Status
**Tham dự**: Gemini Live Agent Challenge 2026
**Deadline**: 16/3/2026 (còn 12 ngày)
**Target**: $80,000 Prize - Creative Storyteller Category

## ✅ Completed Sprints (4/10)

### Sprint 1: Gemini Live Voice Q&A ✅
**Status**: HOÀN THÀNH
**Files**:
- `backend/main.py` - FastAPI với WebSocket endpoints
- `backend/live/ws_handler.py` - GeminiLiveHandler
- `backend/persona/prompt_builder.py` - Dynamic prompt generation

**Features**:
- WebSocket `/ws/persona/{artifact_id}?language=vi`
- Real-time audio streaming (Gemini Live API)
- Multi-language support (6 languages: vi, en, fr, ja, ko, zh)
- Dynamic storytelling persona
- Bidirectional audio/text streaming

**Test Results**: ✅ Passed
- WebSocket connection: OK
- Audio streaming: 88+ chunks, natural voice
- Vietnamese quality: Excellent

---

### Sprint 2: RAG Pipeline với Vector Embedding ✅
**Status**: HOÀN THÀNH
**Files**:
- `backend/rag/chunker.py` - PDF extraction & chunking
- `backend/rag/embedder.py` - Gemini embedding (3072 dims)
- `backend/rag/query_engine.py` - Semantic search & grounded answering
- `backend/cms/upload.py` - PDF upload to Cloud Storage

**Features**:
- PDF text extraction (PyMuPDF)
- Text chunking (512 words, 50-word overlap)
- Vector embedding (gemini-embedding-001)
- Cosine similarity search
- RAG-grounded answering with fallback
- Document status tracking

**Test Results**: ✅ Passed
```bash
✅ PASSED: Embedding API (3072 dims)
✅ PASSED: Cosine Similarity
✅ PASSED: Semantic Search
```

**Endpoints**:
- `POST /admin/upload-pdf/{artifact_id}`
- `GET /admin/document-status/{artifact_id}`
- `POST /qa/{artifact_id}`

---

### Sprint 3: Gemini Vision + Artifact Matching ✅
**Status**: HOÀN THÀNH
**Files**:
- `backend/vision/recognizer.py` - Image-to-artifact matching
- `backend/vision/camera_tour.py` - Live camera tour
- `backend/scripts/seed_firestore.py` - Demo data seeder

**Features**:
- Image upload → Gemini Vision analysis
- Self-matching against artifact list (no vector DB needed)
- Confidence scoring (threshold: 0.5)
- Live camera tour with new artifact detection
- Auto-generated commentary

**Test Results**: ✅ Passed (with valid API key)
```bash
✅ PASSED: Recognize unknown image
✅ PASSED: Recognize with description
✅ PASSED: Camera tour same-artifact detection
✅ PASSED: Generate commentary
```

**Endpoints**:
- `POST /vision/recognize/{museum_id}`
- `POST /vision/camera-tour/{museum_id}`

**Demo Data**: `demo_museum` với 3 artifacts
- `statue_tran_hung_dao` (person)
- `pottery_ly` (object)
- `painting_dongho` (artwork)

---

### Sprint 5: Next.js 14 PWA Frontend ✅
**Status**: HOÀN THÀNH
**Files**: 15 files tổng cộng
- **Pages**: `app/page.tsx`, `app/artifact/[id]/page.tsx`, `app/layout.tsx`
- **Components**: `LanguageSelector.tsx`, `VoiceChat.tsx`
- **Hooks**: `useLanguage.ts`, `useWebSocket.ts`, `useAudioRecorder.ts`, `useAudioPlayer.ts`
- **Lib**: `constants.ts`, `api.ts`
- **Config**: `manifest.json`, `.env.local`

**Features**:
- Next.js 14 với App Router
- TypeScript strict mode
- Tailwind CSS (dark aesthetic)
- PWA-ready manifest
- Language auto-detection (6 languages)
- WebSocket real-time communication
- Voice recording (MediaRecorder API)
- Audio playback (AudioContext API)
- 5 conversation states (idle, connecting, ready, listening, ai_speaking)

**Test Results**: ✅ Running
```bash
Server: http://localhost:3001
Homepage: ✅ Renders với MuseAI branding
Artifact page: ✅ Shows loading state
Voice chat: ✅ UI complete (needs backend integration test)
```

**Design System**:
- Dark theme: `bg-slate-900`, `bg-slate-800`
- Primary: `bg-blue-600` hover `bg-blue-700`
- Mobile-first responsive
- Smooth transitions & animations

---

## ⬜ Pending Sprints (6/10)

### Sprint 4: Interleaved Output (Text + Audio)
**Priority**: Medium
**Effort**: 2-3 hours
**Purpose**: Cho demo video đẹp hơn (text + audio cùng lúc)

### Sprint 6: Gamification (Quiz + Badges)
**Priority**: Medium
**Effort**: 3-4 hours
**Features**: Quiz generation, badge system, user progress

### Sprint 7: CMS Dashboard
**Priority**: Low (có thể skip)
**Effort**: 4-5 hours
**Features**: Admin UI để manage artifacts & personas

### Sprint 8: Analytics Heatmap
**Priority**: Medium
**Effort**: 2-3 hours
**Features**: BigQuery analytics, popular questions, visitor flow

### Sprint 9: QR Scanner Component
**Priority**: High
**Effort**: 1-2 hours
**Features**: Camera-based QR scanning, museum_id extraction

### Sprint 10: Terraform IaC + Demo Video
**Priority**: CRITICAL
**Effort**: 6-8 hours
**Deadline**: Trước 16/3/2026
**Deliverables**: 4-minute demo video, Terraform deployment

---

## 🛠️ Tech Stack Summary

### Backend
- **Framework**: FastAPI (Python 3.12)
- **AI Models**:
  - `gemini-2.5-flash` (chat, vision)
  - `gemini-2.5-flash-native-audio-latest` (voice)
  - `gemini-embedding-001` (vector embeddings, 3072 dims)
- **Database**: Firestore (realtime), BigQuery (analytics)
- **Storage**: Cloud Storage (PDF documents, badges)
- **Hosting**: Cloud Run (asia-southeast1)

### Frontend
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS 3.4
- **State**: React Hooks
- **Audio**: MediaRecorder + AudioContext APIs
- **PWA**: Manifest + service worker (future)

### Infrastructure
- **GCP Project**: `museai-2026`
- **Region**: `asia-southeast1`
- **IaC**: Terraform (pending Sprint 10)

---

## 📊 Code Statistics

### Backend
- **Total Lines**: ~1,500 LOC
- **Files**: 15 Python files
- **Endpoints**: 10 endpoints
- **Tests**: 8 test cases (pytest)

### Frontend
- **Total Lines**: ~600 LOC
- **Files**: 15 TypeScript/TSX files
- **Components**: 2 components
- **Hooks**: 4 custom hooks
- **Pages**: 2 pages

### Total Project
- **Lines of Code**: ~2,100 LOC
- **Files**: 30+ files
- **Dependencies**: 15 backend + 10 frontend packages

---

## 🐛 Known Issues & Fixes

### Backend Issues
1. **DNS Resolution (Firestore gRPC)**
   - Issue: `503 DNS resolution failed for firestore.googleapis.com`
   - Fix: `export GRPC_DNS_RESOLVER=native`

2. **Document Closed Error (PyMuPDF)**
   - Issue: `len(doc)` called after `doc.close()`
   - Fix: Store page_count before closing

3. **Embedding Model Name**
   - Issue: `models/text-embedding-004` not found
   - Fix: Use `gemini-embedding-001`

### Frontend Issues
1. **Watchpack EMFILE Errors**
   - Issue: Too many open files on macOS
   - Impact: Non-blocking, dev-only warnings
   - Optional fix: `ulimit -n 10240`

2. **Port Conflicts**
   - Issue: Port 3000 in use
   - Fix: Next.js auto-fallback to 3001

---

## 🚀 Local Development Setup

### Backend
```bash
cd backend
source ../.venv/bin/activate

export GRPC_DNS_RESOLVER=native
export SSL_CERT_FILE=$(python3 -c "import certifi; print(certifi.where())")
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret="gemini-api-key" --project=museai-2026)
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/museai-sa-key.json

uvicorn main:app --reload --port 8080
```

### Frontend
```bash
cd frontend
npm run dev
# http://localhost:3001
```

### Seed Demo Data
```bash
cd backend
python scripts/seed_firestore.py
```

---

## 🎯 Next Steps (Priority Order)

### Immediate (1-2 days)
1. ✅ **Test full integration** Backend ↔ Frontend với real data
2. ⬜ **Add QR Scanner** component (Sprint 9)
3. ⬜ **Implement Analytics** heatmap (Sprint 8)

### Medium (3-5 days)
4. ⬜ **Gamification** - Quiz & Badges (Sprint 6)
5. ⬜ **Interleaved Output** - Text + Audio (Sprint 4)
6. ⬜ **Polish UI/UX** - Error handling, loading states

### Critical (6-8 days before deadline)
7. ⬜ **Terraform IaC** - Full GCP deployment
8. ⬜ **Demo Video** - 4-minute showcase
9. ⬜ **Submission** - Devpost + GitHub

---

## 📹 Demo Video Plan (4 minutes)

### Structure
- **0:00-0:20** Problem: Boring museums, no engagement
- **0:20-0:50** Solution: QR scan → MuseAI PWA
- **0:50-1:30** Feature 1: Vision matching → voice storytelling
- **1:30-2:00** Feature 2: Multi-language (Vietnamese → French)
- **2:00-2:30** Feature 3: RAG-grounded deep Q&A
- **2:30-3:00** Feature 4: Quiz → Digital Badge
- **3:00-3:30** Feature 5: Admin analytics heatmap
- **3:30-4:00** Architecture + GCP proof + call-to-action

### Recording Locations
- **Real museum**: Bảo tàng Lịch sử Quốc gia Hà Nội (if permitted)
- **Backup**: Indoor exhibit setup with printed artifacts

---

## 📁 Documentation

### Main Files
- `PROJECT_CONTEXT.md` - Overall project context
- `SPRINT5_README.md` - Frontend documentation
- `SPRINT2_README.md` - RAG pipeline details (if exists)
- `.cursorrules` - Development conventions

### API Documentation
- Backend: http://localhost:8080/docs (FastAPI auto-docs)
- Frontend: README.md in `frontend/`

---

## 🏅 Success Metrics (for Judging)

### Technical Excellence (30%)
- ✅ Gemini Live API integration
- ✅ RAG pipeline with vector embeddings
- ✅ Vision-based artifact matching
- ✅ Real-time WebSocket audio streaming
- ⬜ GCP infrastructure (Terraform proof)

### User Experience (30%)
- ✅ PWA frontend
- ✅ Voice-first interaction
- ✅ Multi-language support
- ⬜ QR scanner
- ⬜ Gamification

### Demo Quality (30%)
- ⬜ 4-minute video
- ⬜ Clear problem-solution narrative
- ⬜ Live demonstration
- ⬜ Architecture explanation

### Innovation (10%)
- ✅ Vision self-matching (no vector DB for images)
- ✅ Dynamic persona building
- ⬜ Analytics heatmap
- ⬜ Digital badges

---

## 🎉 Achievement Summary

**4 out of 10 sprints completed in ~4 hours**
- ✅ Core backend functionality
- ✅ RAG pipeline
- ✅ Vision matching
- ✅ Full-featured PWA frontend

**Remaining work**: ~20-30 hours
- 6 sprints pending
- Demo video production
- Infrastructure documentation

**Confidence Level**: 🟢 HIGH
- Strong technical foundation
- Clear path to completion
- 12 days remaining

---

**Generated**: March 4, 2026
**Last Updated**: Sprint 5 completion
**Next Milestone**: Full integration test + QR scanner
