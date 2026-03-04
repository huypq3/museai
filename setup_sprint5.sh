#!/bin/bash

# Sprint 5 Setup Script - Next.js PWA Frontend for MuseAI
# Tạo toàn bộ frontend structure và files

set -e

echo "🚀 SPRINT 5 - NEXT.JS PWA FRONTEND SETUP"
echo "=========================================="

cd /Users/admin/Desktop/guideQR.ai/museai

# Check if frontend exists
if [ -d "frontend" ]; then
    echo "⚠️  frontend/ folder already exists!"
    echo "Do you want to remove and recreate? (yes/no)"
    read -r response
    if [ "$response" = "yes" ]; then
        rm -rf frontend
    else
        echo "Aborting."
        exit 1
    fi
fi

echo ""
echo "📦 Step 1: Creating Next.js 14 project..."
npx create-next-app@14 frontend --typescript --tailwind --app --no-git --yes

echo ""
echo "📦 Step 2: Installing dependencies..."
cd frontend
npm install jsqr @zxing/library

echo ""
echo "📝 Step 3: Creating project structure..."

# Create directories
mkdir -p components hooks lib app/artifact/\[id\]

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: cd /Users/admin/Desktop/guideQR.ai/museai"
echo "2. Run: ./setup_sprint5_files.sh   (to create all component files)"
echo "3. Run: cd frontend && npm run dev"
echo ""
