# MuseAI by GuideQR.ai

![Gemini Live API](https://img.shields.io/badge/Gemini-Live%20API-4285F4?style=flat-square)
![Google Cloud Run](https://img.shields.io/badge/Google%20Cloud-Run-34A853?style=flat-square)
![Vertex AI](https://img.shields.io/badge/Vertex-AI-1A73E8?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-PWA-000000?style=flat-square)

**MuseAI** is a real-time AI museum voice guide: visitors scan a QR code, camera recognizes artifacts, then AI greets and answers questions in live voice across 6 languages.  
Built for **Gemini Live Agent Challenge 2026 (Google/Devpost)** — **Category: Live Agents 🗣️**.

- Demo video: `[Add your Devpost/YouTube link here]`
- Live demo: `https://guideqr.ai` (or `[Add your live URL here]`)

---

## 1) The Problem

Vietnam has **197 museums**, but many face limited guide capacity, high operational cost, and language barriers for international visitors.  
Most tours are static (text/audio pre-recorded), not interactive, and not personalized in real time.

---

## 2) The Solution

MuseAI turns museum visits into live conversations:  
**QR Entry Flow** and **Camera Recognition Flow** are separate but interoperable:
- `QR Entry Flow`: Scan QR → open artifact/museum context in PWA → start real-time voice guide.
- `Camera Recognition Flow`: Open camera tour → detect/match artifact via vision → trigger contextual narration/Q&A.

Visitors do not install any app (PWA), can ask follow-up questions, and can interrupt AI naturally during conversation.

---

## 3) Architecture Diagram

**[Architecture diagram image here]**

**Flow A — QR Entry + Voice Agent**  
`QR Scan → Next.js PWA → Artifact Context Loaded → WebSocket → Gemini Live API → RAG Context (Firestore) → Real-time Voice Response`

**Flow B — Camera Recognition (Independent)**  
`Camera Tour (PWA) → Camera Vision (Vertex AI) → Artifact Match → Contextual Commentary / Voice Q&A`

---

## 4) Tech Stack

| Layer | Technology |
|---|---|
| Live Voice Agent | Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) |
| LLM SDK | Google GenAI SDK |
| Vision + Embeddings | Vertex AI (`gemini-embedding-001`, vision matching) |
| Backend | Python FastAPI + WebSocket |
| Data Store | Firestore (artifacts, knowledge base, analytics) |
| Media Storage | Google Cloud Storage |
| Hosting (Backend) | Google Cloud Run |
| Frontend | Next.js PWA |
| Admin CMS | Next.js + FastAPI admin APIs |

---

## 5) Key Features

- Real-time voice conversation (interruptible)
- Camera-based artifact recognition
- RAG knowledge base (AI answers from museum-provided data)
- Multilingual: `VI / EN / FR / JA / KO / ZH`
- No app install (PWA web flow)
- 2-tier admin panel: Super Admin + Museum Admin
- Analytics dashboard for scans/conversations/languages

---

## 6) Prerequisites

- Python `3.11+`
- Node.js `18+`
- Google Cloud project with billing enabled
- Enabled APIs:
  - Gemini Live API
  - Vertex AI API
  - Firestore API
  - Cloud Storage API
  - Cloud Run API
  - Artifact Registry API
  - Cloud Build API

---

## 7) Quick Start (Local Development)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Required before run:
# 1) set JWT_SECRET (>=32 chars)
# 2) set GEMINI_API_KEY
# 3) set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON path
uvicorn main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_BACKEND_URL
npm run dev
```

Frontend default URL: `http://localhost:3000`  
Backend default URL: `http://localhost:8080`

### Local Smoke Test

After both services are running:

1. Open `http://localhost:3000/welcome?museum=demo_museum`
2. Open `http://localhost:3000/camera-tour?museum=demo_museum`
3. Check backend health: `http://localhost:8080/health`

---

## 8) Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | Yes | `museai-2026` | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes (local) | `./service-account.json` | Service account path |
| `GEMINI_API_KEY` | Yes | `AIza...` | Gemini API auth |
| `GEMINI_LIVE_MODEL` | Yes | `gemini-2.5-flash-native-audio-preview-12-2025` | Live model |
| `JWT_SECRET` | Yes | `min-32-char-secret` | Admin/session JWT signing |
| `REDIS_URL` | Recommended | `redis://localhost:6379` | Rate limiting / lockout |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:3000` | CORS allowlist |
| `GCS_BUCKET` | Yes | `museai-assets` | Artifact image storage |
| `APP_ENV` | Recommended | `development` / `production` | Runtime mode |
| `ENFORCE_HTTPS` | Recommended | `true` / `false` | HTTPS redirect toggle |

Additional security/rate-limit vars are documented in `backend/.env.example`.

Minimum local backend env that must be valid:
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_APPLICATION_CREDENTIALS`

### Frontend (`frontend/.env.local`)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | `http://localhost:8080` | Backend HTTP base URL |
> Note: current code derives WS URL from `NEXT_PUBLIC_BACKEND_URL` and does not require a separate WS env var.

---

## 9) Google Cloud Deployment

### Backend → Cloud Run

```bash
PROJECT_ID="your-project-id"
REGION="asia-southeast1"
SERVICE="museai-backend"

gcloud auth login
gcloud config set project "${PROJECT_ID}"
gcloud auth configure-docker

docker build -t "gcr.io/${PROJECT_ID}/${SERVICE}:latest" ./backend
docker push "gcr.io/${PROJECT_ID}/${SERVICE}:latest"
gcloud run deploy "${SERVICE}" \
  --image "gcr.io/${PROJECT_ID}/${SERVICE}:latest" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},APP_ENV=production,ENFORCE_HTTPS=true,ALLOWED_ORIGINS=https://guideqr.ai,GCS_BUCKET=museai-assets,JWT_SECRET=<your_jwt_secret>,GEMINI_API_KEY=<your_gemini_api_key>,REDIS_URL=<your_redis_url>"
```

If you still prefer Cloud Build, avoid stream-log permission errors:

```bash
gcloud builds submit --tag "gcr.io/${PROJECT_ID}/${SERVICE}:latest" --suppress-logs ./backend
```

### Frontend → Vercel (recommended)

1. Import `frontend/` into Vercel.
2. Set env var: `NEXT_PUBLIC_BACKEND_URL=https://<your-cloud-run-url>`.
3. Deploy.

### Frontend → Cloud Run (alternative)

- Build container for `frontend/` and deploy similarly to backend.
- Ensure `NEXT_PUBLIC_BACKEND_URL` points to backend Cloud Run URL.

### Seed Knowledge Base

```bash
cd backend
python scripts/seed_knowledge_base.py
```

---

## 10) Proof of Google Cloud Deployment

Provide at least one of these for judges:

- Cloud Run public URL: `[Add backend Cloud Run URL here]`
- GCP Console screenshot/recording: `[Add screenshot or drive link here]`
- CI/CD deployment evidence in repo:
  - `.github/workflows/deploy.yml`
  - `cloudbuild.yaml`
  - `backend/Dockerfile`

---

## 11) Project Structure

```bash
museai/
├─ backend/
│  ├─ api/                  # admin/public routers
│  ├─ auth/                 # JWT, RBAC, ephemeral token
│  ├─ live/                 # Gemini Live websocket handler
│  ├─ rag/                  # embeddings, retrieval, query engine
│  ├─ vision/               # camera recognition pipeline
│  ├─ scripts/              # seed knowledge base and data
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ main.py
├─ frontend/
│  ├─ app/                  # Next.js routes (visitor + admin)
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  └─ package.json
├─ tests/
├─ .github/workflows/
├─ cloudbuild.yaml
└─ README.md
```

---

## 12) Hackathon Submission Notes

- **Category**: Live Agents
- **Mandatory Tech Used**:
  - Gemini Live API
  - Google GenAI SDK
  - Google Cloud Run

### Judging Criteria Mapping

- **Innovation & Multimodal UX (40%)**  
  Real-time interruptible voice interaction + camera artifact recognition + multilingual guided conversation in one seamless PWA flow.

- **Technical Implementation (30%)**  
  Production-style architecture with FastAPI WebSocket live sessions, Firestore-backed RAG context control, Vertex AI embeddings, RBAC admin CMS, and Cloud deployment pipeline.

- **Demo & Presentation (30%)**  
  Real-time end-to-end flow (QR → recognition → live Q&A).  
  Video link: `[Add <4-minute demo video link here]`

---

## 13) License

MIT

---

## 14) CI/CD Auto Deploy Setup

This repo includes one GitHub Actions workflow:

- Full deploy pipeline (Backend Cloud Run + Frontend Vercel): `.github/workflows/deploy.yml`

### Required GitHub Secrets

| Secret | Used by | Note |
|---|---|---|
| `GCP_SA_KEY` | Backend | Service account JSON for deploy to Cloud Run |
| `JWT_SECRET` | Backend | Must be at least 32 chars |
| `GEMINI_API_KEY` | Backend | Gemini API key |
| `REDIS_URL` | Backend | Optional but recommended for production rate limiting |
| `VERCEL_TOKEN` | Frontend | Vercel access token |
| `VERCEL_ORG_ID` | Frontend | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Frontend | Vercel project ID |

### Optional GitHub Variables

| Variable | Default |
|---|---|
| `GCP_PROJECT_ID` | `museai-2026` |
| `CLOUD_RUN_REGION` | `asia-southeast1` |
| `CLOUD_RUN_SERVICE` | `museai-backend` |
| `ARTIFACT_REPOSITORY` | `museai-repo` |
| `ALLOWED_ORIGINS` | `https://guideqr.ai` |
| `GCS_BUCKET` | `museai-assets` |

### Trigger Behavior

- Push affecting `backend/**` triggers backend deploy only.
- Push affecting `frontend/**` triggers frontend deploy only.
- You can also run both manually via `workflow_dispatch`.
