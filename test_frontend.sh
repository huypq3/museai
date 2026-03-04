#!/bin/bash

# Sprint 5 - Frontend Testing Checklist
# Run this script to verify all features

echo "============================================"
echo "SPRINT 5 - FRONTEND TESTING CHECKLIST"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test Results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test
test_feature() {
    local feature=$1
    local test_command=$2
    
    echo -n "Testing: $feature... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: npm run dev thành công
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: npm run dev thành công"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if server is running
if lsof -i :3002 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server đang chạy trên port 3002${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Server KHÔNG chạy${NC}"
    echo "   Run: cd frontend && npm run dev"
    ((TESTS_FAILED++))
fi
echo ""

# Test 2: Landing page hiển thị
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Landing page hiển thị"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

response=$(curl -s http://localhost:3002 2>&1)
if echo "$response" | grep -q "MuseAI"; then
    echo -e "${GREEN}✅ Homepage render OK${NC}"
    echo "   - MuseAI title: Found"
    ((TESTS_PASSED++))
    
    if echo "$response" | grep -q "Quét QR"; then
        echo "   - QR button: Found"
    fi
    
    if echo "$response" | grep -q "Demo nhanh"; then
        echo "   - Demo button: Found"
    fi
else
    echo -e "${RED}❌ Homepage KHÔNG render${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Navigate tới artifact page
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Navigate tới artifact page"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

artifact_response=$(curl -s http://localhost:3002/artifact/statue_tran_hung_dao 2>&1)
if echo "$artifact_response" | grep -q "Đang tải"; then
    echo -e "${GREEN}✅ Artifact page render OK${NC}"
    echo "   - Shows loading state"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Artifact page KHÔNG render${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 4-6: Backend-dependent tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4-6: Backend Integration Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if lsof -i :8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend đang chạy trên port 8080${NC}"
    
    # Test WebSocket endpoint
    echo "   Testing WebSocket endpoint..."
    backend_health=$(curl -s http://localhost:8080/health 2>&1)
    if echo "$backend_health" | grep -q "ok\|healthy"; then
        echo -e "${GREEN}   ✅ Backend health check OK${NC}"
        echo ""
        echo -e "${YELLOW}   ⚠️  WebSocket, Voice Q&A, Ngắt lời: Cần test thủ công${NC}"
        echo "      1. Open: http://localhost:3002/artifact/statue_tran_hung_dao"
        echo "      2. Click '🎤 Bắt đầu'"
        echo "      3. Click '🎤 Nhấn để nói'"
        echo "      4. Nói vào mic"
        echo "      5. Click '✋ Dừng'"
        echo "      6. Test '✋ Ngắt lời' khi AI đang nói"
    else
        echo -e "${RED}   ❌ Backend health check FAIL${NC}"
    fi
else
    echo -e "${RED}❌ Backend KHÔNG chạy${NC}"
    echo "   Run backend:"
    echo "   cd backend"
    echo "   export GRPC_DNS_RESOLVER=native"
    echo "   export GEMINI_API_KEY=\$(gcloud secrets versions access latest --secret=\"gemini-api-key\" --project=museai-2026)"
    echo "   uvicorn main:app --reload --port 8080"
    echo ""
    echo -e "${YELLOW}   ⚠️  Skipping WebSocket/Voice tests${NC}"
    ((TESTS_FAILED+=3))
fi
echo ""

# Test 7: Camera Vision hoạt động
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: Camera Vision hoạt động"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if component file exists
if [ -f "frontend/components/CameraVision.tsx" ]; then
    echo -e "${GREEN}✅ CameraVision.tsx exists${NC}"
    echo -e "${YELLOW}   ⚠️  Camera Vision: Cần test thủ công${NC}"
    echo "      1. Add button to homepage (future)"
    echo "      2. Click to open camera"
    echo "      3. Point at artifact"
    echo "      4. Click capture"
    echo "      5. Verify recognition result"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ CameraVision.tsx NOT found${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 8: QR Scanner hoạt động
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 8: QR Scanner hoạt động"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if component exists and is integrated
if [ -f "frontend/components/QRScanner.tsx" ]; then
    echo -e "${GREEN}✅ QRScanner.tsx exists${NC}"
    
    # Check if homepage imports QRScanner
    if grep -q "QRScanner" frontend/app/page.tsx; then
        echo -e "${GREEN}✅ QRScanner integrated in homepage${NC}"
        echo -e "${YELLOW}   ⚠️  QR Scanner: Cần test thủ công${NC}"
        echo "      1. Open: http://localhost:3002"
        echo "      2. Click '📷 Quét QR vào bảo tàng'"
        echo "      3. Allow camera permission"
        echo "      4. Show QR code to camera"
        echo "      5. Verify navigation to artifact"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ QRScanner NOT integrated${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}❌ QRScanner.tsx NOT found${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Test 9: Auto-detect ngôn ngữ
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 9: Auto-detect ngôn ngữ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check useLanguage hook
if [ -f "frontend/hooks/useLanguage.ts" ]; then
    echo -e "${GREEN}✅ useLanguage.ts exists${NC}"
    
    # Check if it has auto-detect logic
    if grep -q "navigator.language" frontend/hooks/useLanguage.ts; then
        echo -e "${GREEN}✅ Auto-detect logic implemented${NC}"
        
        # Check if LanguageSelector shows "Auto" badge
        if grep -q "Auto" frontend/components/LanguageSelector.tsx; then
            echo -e "${GREEN}✅ 'Auto' badge implemented${NC}"
            echo ""
            echo -e "${YELLOW}   ⚠️  Language auto-detect: Test thủ công${NC}"
            echo "      1. Open: http://localhost:3002"
            echo "      2. Check language selector (top-right)"
            echo "      3. Verify 'Auto' badge appears"
            echo "      4. Browser language should be detected"
            echo ""
            echo "   Test cases:"
            echo "   - Browser = Vietnamese → Should select 🇻🇳"
            echo "   - Browser = English → Should select 🇺🇸"
            echo "   - Browser = French → Should select 🇫🇷"
            echo "   - Browser = Japanese → Should select 🇯🇵"
            echo "   - Browser = Korean → Should select 🇰🇷"
            echo "   - Browser = Chinese → Should select 🇨🇳"
            echo ""
            echo "   Test localStorage:"
            echo "   - Change language manually"
            echo "   - Refresh page"
            echo "   - Should persist selection (no 'Auto' badge)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ 'Auto' badge NOT found${NC}"
            ((TESTS_FAILED++))
        fi
    else
        echo -e "${RED}❌ Auto-detect logic NOT found${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}❌ useLanguage.ts NOT found${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# Additional Component Checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BONUS: Component File Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

components=(
    "AudioVisualizer.tsx"
    "TranscriptDisplay.tsx"
    "VoiceChat.tsx"
    "LanguageSelector.tsx"
)

for component in "${components[@]}"; do
    if [ -f "frontend/components/$component" ]; then
        echo -e "${GREEN}✅ $component${NC}"
    else
        echo -e "${RED}❌ $component${NC}"
    fi
done
echo ""

# Summary
echo "============================================"
echo "SUMMARY"
echo "============================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL AUTOMATED TESTS PASSED!${NC}"
    echo ""
    echo "Next: Manual testing required for:"
    echo "  - WebSocket connection"
    echo "  - Voice recording/playback"
    echo "  - Camera Vision"
    echo "  - QR Scanner"
    echo "  - Language auto-detection"
else
    echo -e "${RED}⚠️  Some tests failed. Check output above.${NC}"
fi
echo ""

echo "Manual Test Guide:"
echo "  1. Backend: cd backend && [export env vars] && uvicorn main:app --reload --port 8080"
echo "  2. Frontend: cd frontend && npm run dev"
echo "  3. Open: http://localhost:3002"
echo "  4. Follow test instructions above"
echo ""
echo "============================================"
