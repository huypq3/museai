#!/bin/bash
set -euo pipefail

cd /Users/admin/Desktop/guideQR.ai/museai
source .venv/bin/activate

export GOOGLE_APPLICATION_CREDENTIALS=~/.config/museai-sa-key.json
export FIRESTORE_PREFER_REST=true

# Resolve CA bundle from active venv python.
# Only set SSL_CERT_FILE when path exists; otherwise let OpenSSL use system defaults.
CERT_PATH="$(python - <<'PY'
import os
try:
    import certifi
    p = certifi.where()
    print(p if p and os.path.exists(p) else "")
except Exception:
    print("")
PY
)"
if [ -n "${CERT_PATH:-}" ]; then
  export SSL_CERT_FILE="$CERT_PATH"
  echo "🔒 SSL_CERT_FILE set: $SSL_CERT_FILE"
else
  unset SSL_CERT_FILE || true
  echo "⚠️ SSL_CERT_FILE not set (using system trust store)"
fi

KEY_SOURCE="unknown"

# 1) Prefer local backend/.env
if [ -f backend/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source backend/.env
  set +a
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    KEY_SOURCE="backend/.env"
  fi
fi

# 2) Fallback to Secret Manager if key is still missing
if [ -z "${GEMINI_API_KEY:-}" ]; then
  KEY_PROJECT="${GCP_PROJECT_ID:-museai-2026}"
  export GEMINI_API_KEY="$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project="$KEY_PROJECT")"
  KEY_SOURCE="secret-manager:$KEY_PROJECT"
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "❌ GEMINI_API_KEY is empty"
  exit 1
fi

KEY_LEN=${#GEMINI_API_KEY}
KEY_PREFIX=${GEMINI_API_KEY:0:8}
KEY_SUFFIX=${GEMINI_API_KEY: -6}
KEY_SHA12=$(python - <<'PY'
import os, hashlib
k = os.getenv('GEMINI_API_KEY', '')
print(hashlib.sha256(k.encode()).hexdigest()[:12] if k else 'EMPTY')
PY
)

echo "🔐 GEMINI_API_KEY source: $KEY_SOURCE"
echo "🔑 GEMINI_API_KEY fingerprint: len=$KEY_LEN prefix=${KEY_PREFIX}... suffix=...${KEY_SUFFIX} sha12=$KEY_SHA12"
if [ "${SHOW_FULL_KEY:-false}" = "true" ]; then
  echo "⚠️ FULL GEMINI_API_KEY: $GEMINI_API_KEY"
fi

echo "🚀 Starting backend on port 8080..."
cd backend
uvicorn main:app --reload --port 8080
