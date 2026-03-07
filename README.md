# MuseAI by GuideQR.ai
### AI-Powered Museum Voice Guide

![Gemini Live API](https://img.shields.io/badge/Gemini-Live%20API-4285F4?style=flat-square)
![Google Cloud Run](https://img.shields.io/badge/Google%20Cloud-Run-34A853?style=flat-square)
![Vertex AI](https://img.shields.io/badge/Vertex-AI-1A73E8?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-PWA-000000?style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> "Every exhibit has a story. Now it can tell it."

Gemini Live Agent Challenge 2026 — Category: Live Agents.

- Live demo: https://guideqr.ai
- Demo video: [Add your YouTube/Drive link]
- Devpost: https://geminiliveagentchallenge.devpost.com/

## The Problem
197+ museums in Vietnam alone — yet most international visitors leave without truly understanding what they're seeing.
- Human guides are expensive (~$15,000/month for multilingual coverage) and unavailable outside opening hours
- Traditional audio guides are static: no follow-up questions, no personalization, no interactivity
- Language barriers cut off millions of tourists from exhibit stories told only in the local language
- Existing museum apps require downloads and signups — visitors simply don't bother

## The Solution
MuseAI transforms any museum exhibit into a real-time, interruptible AI conversation — no app required.

1. **Scan** — Visitor scans a QR code at the museum entrance or beside any exhibit
2. **Identify** — Camera vision recognizes the exhibit instantly
3. **Converse** — Gemini Live API answers questions in real-time, grounded in verified museum knowledge (no hallucinations)
4. **Switch** — Visitor changes language mid-conversation across 7 most common languages
5. **Read** — Live transcript displays alongside voice output for noisy environments and accessibility (deaf/hard-of-hearing)

Zero installation. Zero language barrier. 
Every exhibit, every visitor, every language.

## Architecture
[Architecture diagram image here]

```text
Flow A (QR Entry)
QR Scan -> Next.js PWA -> /welcome -> /camera-tour or /exhibit/[id]
-> WebSocket (FastAPI) -> Gemini Live API
-> RAG Context (Firestore + Embeddings)
-> Real-time voice response + transcript

Flow B (Camera Recognition)
Camera Tour -> Vision Matching (Vertex/Gemini Vision)
-> Exhibit Match -> Context Load
-> Gemini Live conversation
```

## Tech Stack
| Layer | Technology |
|---|---|
| Live Voice Agent | Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) |
| Embeddings | `GEMINI_EMBEDDING_MODEL` (default: `gemini-embedding-001`) |
| Backend | Python FastAPI + WebSocket |
| Frontend | Next.js (App Router, PWA-style UX) |
| Database | Firestore |
| Storage | Google Cloud Storage |
| Hosting | Google Cloud Run |
| CI/CD | GitHub Actions |

## Features
- Real-time voice conversation (interruptible)
- Camera-based exhibit recognition
- RAG-grounded answers from museum data
- Multilingual guide for tourists: VI, EN, ES, FR, JA, KO, ZH
- Voice + transcript mode for noisy environments
- Accessibility support for deaf/hard-of-hearing visitors
- QR-first, no app install
- Admin CMS (super admin + museum admin)
- Analytics events pipeline

## Multilingual & Accessibility
MuseAI is designed for mixed visitor groups in real museums:
- Tourists can switch to their preferred language and keep context per exhibit.
- Transcript stays visible while AI speaks, useful in crowded/noisy galleries.
- Transcript-first usage supports visitors with hearing impairments.
- Staff can still provide the same guided experience without extra devices.

## Prerequisites
- Python 3.11+
- Node.js 20+
- Google Cloud project (billing enabled)
- Enabled APIs:
  - Gemini API / Gemini Live
  - Vertex AI API
  - Firestore API
  - Cloud Storage API
  - Cloud Run API
  - Artifact Registry API
  - Cloud Build API

## Spin-up Instructions (Local)

### 1) Clone
```bash
git clone https://github.com/huypq3/museai.git
cd museai
```

### 2) Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
# Fill required vars in .env:
# - JWT_SECRET
# - GEMINI_API_KEY
# - GOOGLE_CLOUD_PROJECT
# - GOOGLE_APPLICATION_CREDENTIALS
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### 3) Frontend
```bash
cd ../frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
npm run dev
```

### 4) Seed Demo Data (optional)
```bash
cd ../backend
source .venv/bin/activate
python scripts/seed_firestore.py
python scripts/seed_knowledge_base.py
python scripts/seed_scenes.py
```

### 5) Smoke Test
- Frontend: http://localhost:3000
- Health: http://localhost:8080/health
- Welcome demo: http://localhost:3000/welcome?museum=demo_museum

## Environment Variables

### Backend
See [`backend/.env.example`](backend/.env.example).
Critical vars:
- `JWT_SECRET` (required, >= 32 chars)
- `GEMINI_API_KEY` (required)
- `GEMINI_EMBEDDING_MODEL` (optional, default: `gemini-embedding-001`)
- `GOOGLE_CLOUD_PROJECT` (required)
- `GOOGLE_APPLICATION_CREDENTIALS` (required for local GCP auth)
- `ALLOWED_ORIGINS` (must include frontend origin)
- `GCS_BUCKET` / `GCS_BUCKET_NAME`

### Frontend
See [`frontend/.env.example`](frontend/.env.example).
Critical var:
- `NEXT_PUBLIC_BACKEND_URL`

## Deploy to Google Cloud

### Backend -> Cloud Run
```bash
PROJECT_ID="your-project-id"
REGION="asia-southeast1"
SERVICE="museai-backend"

# Build & push
gcloud builds submit ./backend \
  --tag "asia-southeast1-docker.pkg.dev/${PROJECT_ID}/museai-repo/backend:latest"

# Deploy
gcloud run deploy "${SERVICE}" \
  --image "asia-southeast1-docker.pkg.dev/${PROJECT_ID}/museai-repo/backend:latest" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},APP_ENV=production,ENFORCE_HTTPS=true,ALLOWED_ORIGINS=https://guideqr.ai,https://www.guideqr.ai"
```

### Frontend
Deploy `frontend/` to Vercel (recommended) or Cloud Run.
Set:
- `NEXT_PUBLIC_BACKEND_URL=https://<your-cloud-run-service>.run.app`

## Proof of Google Cloud Deployment
Provide at least one for judges:
- Cloud Run service URL (public)
- GCP Console screenshot/video of running service
- CI/CD evidence:
  - `.github/workflows/deploy-backend.yml`
  - `.github/workflows/deploy-frontend.yml`
  - `backend/Dockerfile`

## Project Structure
```text
museai/
├─ backend/
│  ├─ api/
│  ├─ auth/
│  ├─ live/
│  ├─ rag/
│  ├─ vision/
│  ├─ scripts/
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ main.py
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  └─ package.json
├─ .github/workflows/
└─ README.md
```

## Hackathon Notes
- Category: Live Agents
- Mandatory technologies used:
  - Gemini Live API
  - Google GenAI SDK
  - Cloud Run
- Judging criteria mapping:
  - Innovation & UX: real-time voice + camera + QR
  - Technical implementation: WebSocket streaming + RAG + RBAC CMS
  - Demo & presentation: [Add demo video link]

## Security Notes
- Do not commit `.env`, service account JSON, or secrets.
- Rotate keys before public demo.
- Use strong `JWT_SECRET` and bcrypt password hashes.

## License
MIT
