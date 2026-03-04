#!/bin/bash
cd /Users/admin/Desktop/guideQR.ai/museai
source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/museai-sa-key.json
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=museai-2026)
export SSL_CERT_FILE=$(python3 -c "import certifi; print(certifi.where())")
export FIRESTORE_PREFER_REST=true
echo "🔑 GEMINI_API_KEY: ${GEMINI_API_KEY:0:15}..."
echo "🚀 Starting backend on port 8080..."
cd backend
uvicorn main:app --reload --port 8080
