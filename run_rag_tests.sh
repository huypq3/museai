#!/bin/bash

# Script để chạy RAG tests với environment setup đúng
# Bạn cần set GEMINI_API_KEY trước khi chạy

echo "🔧 Setting up environment..."

# Activate venv
cd /Users/admin/Desktop/guideQR.ai/museai
source .venv/bin/activate

# SSL fix
export SSL_CERT_FILE=$(python3 -c "import certifi; print(certifi.where())")
export REQUESTS_CA_BUNDLE=$SSL_CERT_FILE

# GCP
export GOOGLE_CLOUD_PROJECT=museai-2026
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/museai-sa-key.json

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY not set!"
    echo ""
    echo "Please set it first:"
    echo "  export GEMINI_API_KEY='your-api-key-here'"
    echo ""
    echo "Or get it from Secret Manager:"
    echo "  export GEMINI_API_KEY=\$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=museai-2026)"
    echo ""
    exit 1
fi

echo "✅ GEMINI_API_KEY is set"
echo "✅ GCP credentials configured"
echo ""

# Run tests
echo "🧪 Running RAG tests..."
python tests/test_rag_simple.py

exit $?
