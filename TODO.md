# MuseAI - Todo Checklist ✅

## 🔥 SPRINT 5 - HOÀN THÀNH ✅
- [x] Setup Next.js 14 project
- [x] Create component structure
- [x] Implement useLanguage hook (auto-detect)
- [x] Implement useWebSocket hook
- [x] Implement useAudioRecorder hook
- [x] Implement useAudioPlayer hook
- [x] Create LanguageSelector component
- [x] Create VoiceChat component
- [x] Create landing page
- [x] Create artifact page
- [x] Configure Tailwind CSS
- [x] Add PWA manifest
- [x] Test dev server
- [x] Documentation (SPRINT5_README.md)

## 🎯 IMMEDIATE TASKS (1-2 days)

### Integration Testing
- [ ] Start backend server với GRPC_DNS_RESOLVER=native
- [ ] Start frontend server
- [ ] Test full flow: Homepage → Artifact → Voice Chat
- [ ] Test WebSocket connection backend ↔ frontend
- [ ] Test audio recording → backend
- [ ] Test audio playback backend → frontend
- [ ] Test language switching
- [ ] Test error states
- [ ] Fix any integration bugs

### QR Scanner (Sprint 9)
- [ ] Create `components/QRScanner.tsx`
- [ ] Implement camera access
- [ ] Integrate jsQR + @zxing/library
- [ ] Parse QR data format: `https://museai.app?museum={id}&artifact={id}`
- [ ] Add to landing page
- [ ] Test với printed QR codes
- [ ] Handle camera permissions

## 🏃 SHORT-TERM TASKS (3-5 days)

### Analytics Dashboard (Sprint 8)
- [ ] Create `backend/analytics/bigquery_client.py`
- [ ] Implement `log_scan_event()`
- [ ] Implement `log_qa_interaction()`
- [ ] Create `backend/analytics/heatmap.py`
- [ ] Add `/admin/analytics/popular-questions` endpoint
- [ ] Add `/admin/analytics/artifact-popularity` endpoint
- [ ] Add `/admin/analytics/session-duration` endpoint
- [ ] Create `frontend/app/admin/page.tsx`
- [ ] Add heatmap visualization component
- [ ] Add popular questions list
- [ ] Add visitor flow chart

### Gamification (Sprint 6)
- [ ] Create `backend/gamify/quiz_generator.py`
- [ ] Implement `generate_quiz(artifact_id, difficulty)` với Gemini
- [ ] Create `backend/gamify/badge_system.py`
- [ ] Define badge rules (e.g., "Visit 5 artifacts", "Perfect quiz")
- [ ] Create badges collection in Firestore
- [ ] Add `/gamify/quiz/{artifact_id}` endpoint
- [ ] Add `/gamify/submit-quiz` endpoint
- [ ] Add `/gamify/badges/{user_id}` endpoint
- [ ] Create `frontend/components/Quiz.tsx`
- [ ] Create `frontend/components/BadgeCollection.tsx`
- [ ] Generate badge images (Imagen or manual design)
- [ ] Upload to Cloud Storage
- [ ] Test quiz flow
- [ ] Test badge earning

### Interleaved Output (Sprint 4)
- [ ] Update `ws_handler.py` để handle text + audio cùng lúc
- [ ] Add `response_modalities=["TEXT", "AUDIO"]`
- [ ] Create `frontend/components/TranscriptDisplay.tsx`
- [ ] Update VoiceChat để show transcript realtime
- [ ] Sync text với audio playback
- [ ] Add auto-scroll
- [ ] Test với multi-modal responses

## 🚀 CRITICAL TASKS (6-8 days before deadline)

### Terraform IaC (Sprint 10)
- [ ] Create `infra/terraform/main.tf`
- [ ] Define Cloud Run service
- [ ] Define Firestore database
- [ ] Define Cloud Storage buckets
- [ ] Define BigQuery dataset
- [ ] Define Secret Manager secrets
- [ ] Define service account + IAM roles
- [ ] Define VPC/networking (if needed)
- [ ] Add `terraform.tfvars.example`
- [ ] Test `terraform plan`
- [ ] Test `terraform apply`
- [ ] Document deployment steps
- [ ] Create `DEPLOYMENT.md`

### Demo Video Production
- [ ] Write script (4 minutes)
- [ ] Prepare demo data (3-5 artifacts)
- [ ] Choose recording location (real museum or mock-up)
- [ ] Record footage:
  - [ ] Problem introduction (0:20)
  - [ ] QR scan demo (0:30)
  - [ ] Vision matching demo (0:40)
  - [ ] Multi-language demo (0:30)
  - [ ] RAG Q&A demo (0:30)
  - [ ] Quiz/Badge demo (0:30)
  - [ ] Analytics dashboard (0:30)
  - [ ] Architecture explanation (0:30)
- [ ] Edit video
- [ ] Add captions/subtitles
- [ ] Add background music
- [ ] Add text overlays
- [ ] Review & polish
- [ ] Export final video (MP4, max 100MB)

### Devpost Submission
- [ ] Create project page on Devpost
- [ ] Write project description
- [ ] Add screenshots (10+ images):
  - [ ] Landing page
  - [ ] QR scan
  - [ ] Artifact page
  - [ ] Voice chat UI
  - [ ] Quiz UI
  - [ ] Badge collection
  - [ ] Analytics dashboard
  - [ ] Architecture diagram
- [ ] Upload demo video
- [ ] Add GitHub repo link
- [ ] Add live demo link (if Cloud Run public)
- [ ] List technologies used
- [ ] Write "Inspiration" section
- [ ] Write "What it does" section
- [ ] Write "How we built it" section
- [ ] Write "Challenges we ran into" section
- [ ] Write "Accomplishments" section
- [ ] Write "What we learned" section
- [ ] Write "What's next" section
- [ ] Submit before deadline (16/3/2026)

## 🎨 POLISH TASKS (Ongoing)

### Frontend UX
- [ ] Add loading spinners
- [ ] Add error messages (user-friendly)
- [ ] Add empty states
- [ ] Add success notifications
- [ ] Improve mobile responsiveness
- [ ] Add touch gestures
- [ ] Add animations (subtle)
- [ ] Add sound effects (optional)
- [ ] Optimize images
- [ ] Add favicon
- [ ] Add PWA icons (192x192, 512x512)

### Backend Robustness
- [ ] Add request validation
- [ ] Add rate limiting
- [ ] Add error logging
- [ ] Add health check endpoints
- [ ] Add metrics (Prometheus/GCP)
- [ ] Add graceful shutdown
- [ ] Add connection pooling
- [ ] Optimize Firestore queries
- [ ] Add caching (Redis or in-memory)

### Testing
- [ ] Add more unit tests
- [ ] Add integration tests
- [ ] Add E2E tests (Playwright)
- [ ] Test on multiple browsers
- [ ] Test on multiple devices
- [ ] Test with slow network
- [ ] Test with offline mode (PWA)
- [ ] Load testing (Artillery or k6)

### Documentation
- [ ] Update README.md
- [ ] Add API documentation
- [ ] Add architecture diagram
- [ ] Add sequence diagrams
- [ ] Add database schema diagram
- [ ] Add deployment guide
- [ ] Add troubleshooting guide
- [ ] Add contribution guide (if open-source)

## 📅 TIMELINE

### Week 1 (Days 1-3) - NOW
- ✅ Sprint 1-3, 5 complete
- 🔄 Integration testing
- 🔄 QR Scanner

### Week 2 (Days 4-7)
- Sprint 8 (Analytics)
- Sprint 6 (Gamification)
- Sprint 4 (Interleaved Output)
- Polish UI/UX

### Week 3 (Days 8-12) - CRITICAL
- Sprint 10 (Terraform)
- Demo video production
- Devpost submission prep
- Final testing

### Day 13 (16/3/2026) - DEADLINE
- Final submission
- Video upload
- Cross fingers 🤞

---

## 🎯 PRIORITY LEVELS

**P0 (Must Have)**
- [x] Backend voice API
- [x] Frontend PWA
- [ ] QR Scanner
- [ ] Demo video
- [ ] Devpost submission

**P1 (Should Have)**
- [x] RAG pipeline
- [x] Vision matching
- [ ] Analytics dashboard
- [ ] Terraform IaC

**P2 (Nice to Have)**
- [ ] Gamification
- [ ] Interleaved output
- [ ] CMS dashboard
- [ ] Advanced testing

**P3 (Future)**
- [ ] Mobile apps (iOS/Android)
- [ ] AR features
- [ ] Offline mode
- [ ] Vector DB for images

---

**Last Updated**: March 4, 2026 - Sprint 5 Complete
**Progress**: 40% complete (4/10 sprints)
**Days Remaining**: 12 days
**Status**: 🟢 ON TRACK
