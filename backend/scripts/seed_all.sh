#!/usr/bin/env bash
set -euo pipefail

# Local reseed helper — Bảo tàng Dân tộc học Việt Nam
#
# Usage:
#   cd backend
#   chmod +x scripts/seed_all.sh
#   ./scripts/seed_all.sh
#
# Optional override:
#   GOOGLE_CLOUD_PROJECT=your-project ./scripts/seed_all.sh
#   SEED_MUSEUM_ID=vietnam_ethnology_museum ./scripts/seed_all.sh

echo "🌱 MuseAI seed started — Bảo tàng Dân tộc học Việt Nam"
echo "========================================================"

if [[ -f ".env" ]]; then
  # shellcheck disable=SC1091
  source .env
fi

PYTHON_BIN="../.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

echo "Using Python : $PYTHON_BIN"
echo "Project      : ${GOOGLE_CLOUD_PROJECT:-<not-set>}"
echo "Museum ID    : ${SEED_MUSEUM_ID:-vietnam_ethnology_museum}"
echo ""

echo "1) Seed base Firestore data (museum, exhibits, personas)"
"$PYTHON_BIN" scripts/seed_firestore.py

echo ""
echo "2) Seed knowledge base + embeddings"
"$PYTHON_BIN" scripts/seed_knowledge_base.py

echo ""
echo "3) Seed scenes"
"$PYTHON_BIN" scripts/seed_scenes.py

echo ""
echo "========================================================"
echo "✅ Seed completed!"
echo "   Museum   : Bảo tàng Dân tộc học Việt Nam"
echo "   Exhibit  : Trống đồng Đông Sơn (dong_son_drum)"
echo "   Chunks   : 15 knowledge base chunks"
echo "   Scenes   : 8 visual scenes"
