# 🔍 Debug: Không nghe thấy audio sau khi dừng ghi âm

## 🐛 Vấn đề

**Hiện tượng:**
- User click "Dừng ghi âm"
- Client báo "AI đang trả lời..."
- **KHÔNG** nghe thấy audio phát ra
- **KHÔNG** thấy log audio từ server xuống client

---

## 🔬 Checklist Debug

### **1. Kiểm tra Backend Log**

Sau khi click "Dừng", server log phải có:

```
✅ EXPECTED LOG:
📥 Received end_of_turn from client, sending to Gemini...
✅ Sent end_of_turn to Gemini, waiting for response...
📤 Gemini response: data=XXXX bytes, text=..., turn_complete=False
✅ Sent audio chunk to client (XXXX bytes, base64: YYYY chars)
📤 Gemini response: data=XXXX bytes, text=..., turn_complete=False
✅ Sent audio chunk to client (XXXX bytes, base64: YYYY chars)
...
📤 Gemini response: data=0 bytes, text=..., turn_complete=True
```

**Nếu KHÔNG thấy `✅ Sent audio chunk`:**
- Gemini KHÔNG tạo audio
- Vấn đề: Config sai hoặc prompt không đúng

---

### **2. Kiểm tra Frontend Console Log**

Browser console phải có:

```
✅ EXPECTED LOG:
📥 Processing NEW messages from index X to Y
  [X] type: audio_chunk
🔊 [X] Playing audio chunk (2048 chars)
  [X+1] type: audio_chunk
🔊 [X+1] Playing audio chunk (1876 chars)
...
  [Y] type: turn_complete
✅ [Y] Turn complete - AI finished
✅ Updated lastProcessedIndex to Y
```

**Nếu KHÔNG thấy `🔊 Playing audio chunk`:**
- Frontend KHÔNG nhận được audio từ backend
- Vấn đề: WebSocket message format hoặc useEffect không chạy

---

### **3. Kiểm tra WebSocket Messages**

Mở DevTools → Network tab → WS (WebSocket) → Messages

Phải thấy:

```json
← Backend gửi:
{"type": "audio_chunk", "audio": "AAAAAQABAAEA..."}
{"type": "audio_chunk", "audio": "BBBBBBBBBBBB..."}
{"type": "transcript", "text": "Xin chào, tôi là..."}
{"type": "turn_complete"}
```

**Nếu KHÔNG thấy `"type": "audio_chunk"`:**
- Backend không gửi audio
- Quay lại check backend log

---

## 🛠️ Fixes đã áp dụng

### **Fix #1: Thêm `speech_config` vào Gemini config**

**File:** `backend/live/ws_handler.py` line 62-67

```python
config = {
    "response_modalities": ["AUDIO"],
    "speech_config": {
        "voice_config": {"prebuilt_voice_config": {"voice_name": "Puck"}}
    },
    "system_instruction": system_instruction_content,
}
```

**Lý do:**
- `response_modalities: ["AUDIO"]` chỉ báo Gemini TRẢ VỀ audio
- Nhưng **PHẢI** có `speech_config` để Gemini biết VOICE nào sử dụng
- Không có `speech_config` → Gemini có thể trả text only

---

### **Fix #2: Thêm detailed logging**

**Added logs:**
- Line 157: `📥 Received end_of_turn from client`
- Line 170: `✅ Sent end_of_turn to Gemini, waiting for response...`
- Line 210: `✅ Sent audio chunk to client (X bytes, base64: Y chars)`

**Purpose:**
- Track từng bước trong flow
- Xác định chính xác điểm lỗi

---

### **Fix #3: Silent audio chunk cho end_of_turn**

**File:** `backend/live/ws_handler.py` line 159-168

```python
await session.send(
    input=types.LiveClientRealtimeInput(
        media_chunks=[
            types.Blob(
                data=b'\x00\x00',  # 2 bytes silent PCM
                mime_type="audio/pcm;rate=16000"
            )
        ]
    ),
    end_of_turn=True
)
```

**Lý do:**
- Gemini API yêu cầu `input` là required parameter
- `media_chunks=[]` (empty) gây lỗi `IndexError: list index out of range`
- Phải gửi ít nhất 1 chunk, dùng silent audio `b'\x00\x00'`

---

## 🧪 Test Plan

### **Step 1: Hard Refresh**
```bash
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows/Linux)
```

### **Step 2: Open Console & Network Tab**
- F12 → Console tab
- F12 → Network tab → WS filter

### **Step 3: Test Flow**
1. Click "🎤 Bắt đầu"
2. Click "🎤 Nhấn để nói"
3. Nói: "Xin chào, bạn là ai?"
4. Click "✋ Dừng"

### **Step 4: Check Logs**

**Backend Terminal:**
```bash
tail -f /Users/admin/.cursor/projects/Users-admin-Desktop-guideQR-ai-museai/terminals/631594.txt
```

**Expected backend log:**
```
INFO: 📥 Received from client: type=audio, size=8192 bytes
INFO: 📥 Received from client: type=audio, size=8192 bytes
...
INFO: 📥 Received end_of_turn from client, sending to Gemini...
INFO: ✅ Sent end_of_turn to Gemini, waiting for response...
INFO: 📤 Gemini response: data=4096 bytes, text=Xin chào..., turn_complete=False
INFO: ✅ Sent audio chunk to client (4096 bytes, base64: 5461 chars)
...
```

**Browser Console:**
```
📥 Processing NEW messages from index 1 to 5
  [1] type: audio_chunk
🔊 [1] Playing audio chunk (5461 chars)
✅ Playing PCM chunk: 2048 samples, 0.09s
...
```

### **Step 5: Verify Audio Playback**
- Nghe thấy giọng nói AI
- Không bị loop
- Không bị delay quá lâu (>3s)

---

## 🔧 Potential Issues & Solutions

### **Issue 1: Backend log KHÔNG có `Gemini response: data=XXXX bytes`**

**Nguyên nhân:**
- Gemini không tạo audio
- Config sai hoặc API key invalid

**Giải pháp:**
```bash
# Check API key
echo $GEMINI_API_KEY

# Verify config trong ws_handler.py có đủ:
# - response_modalities: ["AUDIO"]
# - speech_config: {...}
```

---

### **Issue 2: Backend gửi audio nhưng frontend KHÔNG nhận**

**Nguyên nhân:**
- WebSocket message format không khớp
- Frontend useEffect không trigger

**Giải pháp:**
- Check Network tab → WS messages
- Verify backend gửi: `{"type": "audio_chunk", "audio": "..."}`
- Verify frontend check: `msg.type === "audio_chunk"` và `msg.audio`

---

### **Issue 3: Frontend nhận audio nhưng KHÔNG phát**

**Nguyên nhân:**
- `useAudioPlayer.ts` decode lỗi
- AudioContext issue
- Browser autoplay policy

**Giải pháp:**
```javascript
// Check console for errors:
// ❌ Failed to play audio chunk: ...

// If "AudioContext suspended":
// → User phải interact trước (click button)
// → Already handled in useAudioPlayer resume()
```

---

### **Issue 4: Audio phát nhưng bị distorted/choppy**

**Nguyên nhân:**
- Sample rate mismatch (frontend expect 24kHz, backend gửi khác)
- PCM format sai (Int16 vs Float32)

**Giải pháp:**
- Check Gemini trả về audio format (should be PCM 24kHz)
- Verify `useAudioPlayer.ts` decode đúng format:
  ```typescript
  const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
  ```

---

## 📊 Current Status

### ✅ Fixed:
1. Auto-greeting prompt removed
2. useEffect dependencies optimized
3. end_of_turn API call corrected
4. speech_config added to Gemini config
5. Detailed logging added

### 🔬 Testing:
- Backend server running on port 8080
- Frontend ready for testing
- Logs enabled for debugging

### 📋 Next Steps:
1. User test full flow
2. Share backend + frontend logs
3. Identify exact failure point
4. Apply targeted fix

---

**📅 Date:** 2026-03-04  
**🔬 Status:** Waiting for user test results with detailed logs
