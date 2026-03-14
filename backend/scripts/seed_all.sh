#!/usr/bin/env bash
set -euo pipefail

# Local reseed helper — Tranh Đông Hồ Em Bé Ôm Cá Chép
# Museum: Bảo tàng Dân tộc học Việt Nam
#
# Usage:
#   cd backend
#   chmod +x scripts/seed_all.sh
#   ./scripts/seed_all.sh
#
# Optional override:
#   GOOGLE_CLOUD_PROJECT=your-project ./scripts/seed_all.sh
#   SEED_EXHIBIT_ID=dong_ho_baby_fish ./scripts/seed_all.sh

echo "🌱 MuseAI seed started — Tranh Đông Hồ Em Bé Ôm Cá Chép"
echo "=========================================================="

if [[ -f ".env" ]]; then
  # shellcheck disable=SC1091
  source .env
fi

PYTHON_BIN="../.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

echo "Using Python  : $PYTHON_BIN"
echo "Project       : ${GOOGLE_CLOUD_PROJECT:-<not-set>}"
echo "Museum ID     : ${SEED_MUSEUM_ID:-vietnam_ethnology_museum}"
echo "Exhibit ID    : ${SEED_EXHIBIT_ID:-dong_ho_baby_fish}"
echo ""

echo "1) Seed base Firestore data (museum, exhibit, persona)"
"$PYTHON_BIN" scripts/seed_firestore.py

echo ""
echo "2) Seed knowledge base + embeddings"
"$PYTHON_BIN" scripts/seed_knowledge_base.py

echo ""
echo "3) Seed scenes"
"$PYTHON_BIN" scripts/seed_scenes.py

echo ""
echo "=========================================================="
echo "✅ Seed completed!"
echo "   Museum   : Bảo tàng Dân tộc học Việt Nam"
echo "   Exhibit  : Tranh Đông Hồ Em Bé Ôm Cá Chép (dong_ho_baby_fish)"
echo "   Persona  : dong_ho_fish_guide"
echo "   Chunks   : 15 knowledge base chunks"
echo "   Scenes   : 8 visual scenes"
