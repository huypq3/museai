#!/usr/bin/env bash
set -euo pipefail

# Local reseed helper for exhibit-first schema.
#
# Usage:
#   cd backend
#   chmod +x scripts/reseed_local.sh
#   ./scripts/reseed_local.sh
#
# Optional:
#   GOOGLE_CLOUD_PROJECT=your-project-id ./scripts/reseed_local.sh

echo "🌱 MuseAI local seed started"

if [[ -f ".env" ]]; then
  # shellcheck disable=SC1091
  source .env
fi

PYTHON_BIN="../.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

echo "Using Python: $PYTHON_BIN"
echo "Project: ${GOOGLE_CLOUD_PROJECT:-<not-set>}"

echo "1) Seed base Firestore data (museums, exhibits, personas)"
"$PYTHON_BIN" scripts/seed_firestore.py

echo "2) Seed knowledge base + embeddings (exhibits)"
"$PYTHON_BIN" scripts/seed_knowledge_base.py

echo "3) Seed scenes (exhibits)"
"$PYTHON_BIN" scripts/seed_scenes.py

echo "✅ Seed completed"
