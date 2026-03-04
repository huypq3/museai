# 🐛 FIX: Lần 1 OK, lần 2+ không trả về audio

## 🔍 Vấn đề

**Hiện tượng:**
- **Lần 1:** Hỏi → Gemini trả lời → Nghe thấy audio ✅
- **Lần 2:** Click "Ngắt lời" → Hỏi câu khác → **KHÔNG** nghe thấy audio ❌
- **Lần 3+:** Tiếp tục fail

---

## 🛠️ Fixes đã áp dụng

### **Fix #1: Frontend `handleInterrupt` gửi sai format**

**Trước (SAI):**
```typescript
const handleInterrupt = () => {
  stopAudio();
  sendMessage({ type: "interrupt" });  
  setState("listening");
  startRecording((base64) => {
    sendMessage({ type: "audio_chunk", audio: base64 });  // ← SAI!
  });
};
```

**Vấn đề:**
- Gửi `type: "audio_chunk"` với key `"audio"`
- Backend chỉ xử lý `type: "audio"` với key `"data"`
- → Audio bị ignore

**Sau (ĐÚNG):**
```typescript
const handleInterrupt = () => {
  console.log("🛑 INTERRUPT called - stopping AI");
  stopAudio();
  sendMessage({ type: "interrupt" });  // Notify backend
  setState("listening");
  startRecording((base64) => {
    sendMessage({ type: "audio", data: base64 });  // ✅ Đúng format
  });
};
```

---

### **Fix #2: Backend không xử lý message type "interrupt"**

**Added handler:**
```python
elif msg_type == "interrupt":
    # Client báo hiệu muốn interrupt AI đang nói
    logger.info("📥 Received interrupt from client")
    # Gemini Live API không có trực tiếp interrupt
    # Workaround: Chỉ stop audio ở client side (đã handle ở frontend)
    # Backend không cần làm gì vì turn mới sẽ tự động override
    pass
```

---

## 🧪 Test Plan

### **Step 1: Test lần 1**
1. Hard refresh: `Cmd+Shift+R`
2. Mở: http://localhost:3002/artifact/statue_tran_hung_dao
3. Click "🎤 Bắt đầu" → "🎤 Nhấn để nói"
4. Nói DÀI (5+ giây): "Xin chào, ông Trần Hưng Đạo là ai?"
5. Click "✋ Dừng"
6. **Verify:** Nghe thấy audio

### **Step 2: Test lần 2 (CRITICAL)**
7. **TRONG KHI AI ĐANG NÓI:** Click "✋ Ngắt lời"
8. **NGAY LẬP TỨC:** Click "🎤 Nhấn để nói"
9. Nói DÀI (5+ giây): "Ông ấy sinh năm nào?"
10. Click "✋ Dừng"
11. **Verify:** Nghe thấy audio

### **Step 3: Test lần 3**
12. Lặp lại step 7-11
13. **Verify:** Vẫn nghe thấy audio

---

## 📊 Debug Info cần thu thập

### **Backend log - Lần 1 (THÀNH CÔNG):**
```
📥 Received from client: type=audio, size=8192 bytes (x nhiều lần)
📥 Received end_of_turn from client, signaling Gemini...
✅ Sent end_of_turn signal to Gemini, waiting for response...
📤 Gemini response: data=4096 bytes, text=Xin chào!...  ← CÓ AUDIO
✅ Sent audio chunk to client (4096 bytes, base64: 5461 chars)
...
📤 Gemini response: data=0 bytes, text=None, turn_complete=True
```

### **Backend log - Lần 2 (THẤT BẠI - CẦN XEM):**
```
📥 Received interrupt from client  ← Nếu có
📥 Received from client: type=audio, size=8192 bytes (x nhiều lần)
📥 Received end_of_turn from client, signaling Gemini...
✅ Sent end_of_turn signal to Gemini, waiting for response...
📤 Gemini response: data=??? bytes, text=???  ← SO SÁNH VỚI LẦN 1
```

**Câu hỏi quan trọng:**
- Lần 2 có log `📥 Received from client: type=audio` không?
- Nếu KHÔNG → Frontend không gửi audio (bug ở recorder)
- Nếu CÓ nhưng Gemini vẫn trả `data=0` → Gemini session issue

---

## 🔬 Possible Root Causes (chưa verify)

### **Hypothesis 1: Audio recorder không restart đúng**

**Vấn đề:**
- Lần 1: Recorder start OK
- Click "Ngắt lời" → Recorder stop
- Click "Nhấn để nói" lần 2 → Recorder **KHÔNG start** hoặc **KHÔNG gửi chunks**

**Kiểm tra:**
- Browser console lần 2 có log `🎤 Recording started` không?
- Có log `🎙️ Audio chunk #0` không?

**Nếu KHÔNG:**
→ Bug ở `useAudioRecorder.ts` - recorder không cleanup đúng

---

### **Hypothesis 2: Gemini session bị "stuck" sau turn 1**

**Vấn đề:**
- Lần 1: Gemini xử lý OK
- Lần 2: Gemini nhận audio NHƯNG không trả lời (data=0)

**Nguyên nhân có thể:**
- Gemini đang chờ `turn_complete` từ turn 1
- Session state bị corrupt
- `input=" "` pattern gây confusion

**Giải pháp tiềm năng:**
- Gửi một "reset" signal sau mỗi turn
- Hoặc: Không dùng `input=" "`, thử pattern khác

---

### **Hypothesis 3: Frontend state không sync**

**Vấn đề:**
- `lastProcessedIndexRef` không reset khi cần
- `wsMessages` array bị duplicate
- `useEffect` không trigger cho messages lần 2

**Kiểm tra:**
- Browser console lần 2 có log `📥 Processing NEW messages` không?
- `lastProcessedIndexRef` value là bao nhiêu?

---

## ✅ Action Items

### **NGAY BÂY GIỜ:**

1. **Hard refresh** browser: `Cmd+Shift+R`
2. **Test full flow** (lần 1 → ngắt lời → lần 2)
3. **Capture logs:**
   - Backend terminal: Copy TOÀN BỘ log từ lúc connect đến lần 2 xong
   - Browser console: Copy TOÀN BỘ log từ lúc page load đến lần 2 xong
4. **Share logs** để phân tích

### **Thông tin cần:**

**Backend log phải có:**
```
--- LẦN 1 ---
Connected to Gemini Live API
📥 Received from client: type=audio, size=8192 bytes
... (nhiều dòng)
📥 Received end_of_turn from client
📤 Gemini response: data=XXXX bytes  ← QUAN TRỌNG!

--- LẦN 2 ---
📥 Received interrupt from client  ← Nếu có
📥 Received from client: type=audio, size=8192 bytes
... (nhiều dòng)
📥 Received end_of_turn from client
📤 Gemini response: data=??? bytes  ← SO SÁNH!
```

**Browser console phải có:**
```
--- LẦN 1 ---
🎤 Recording started (PCM 16kHz mono)
🎙️ Audio chunk #0: 4096 samples
🛑 STOP LISTENING called
📥 Processing NEW messages from index X to Y
🔊 Playing audio chunk

--- LẦN 2 ---
🛑 INTERRUPT called - stopping AI  ← Nếu có
🎤 Recording started (PCM 16kHz mono)  ← XEM CÓ KHÔNG?
🎙️ Audio chunk #0: 4096 samples      ← XEM CÓ KHÔNG?
🛑 STOP LISTENING called
📥 Processing NEW messages from index Z to W  ← XEM CÓ KHÔNG?
```

---

## 🎯 Expected Behavior sau fix

### **Lần 1:**
- User nói → Audio gửi → Gemini trả lời → Nghe thấy ✅

### **Lần 2:**
- Click "Ngắt lời" → Audio stop
- Frontend log: `🛑 INTERRUPT called`
- Backend log: `📥 Received interrupt`
- Click "Nhấn để nói" → Recorder start lại
- Frontend log: `🎤 Recording started`
- Nói → Audio gửi
- Backend log: `📥 Received from client: type=audio`
- Click "Dừng" → `end_of_turn`
- Gemini trả lời → Nghe thấy ✅

### **Lần 3+:**
- Lặp lại như lần 2 ✅

---

**📅 Date:** 2026-03-04  
**✅ Status:** Fixes applied, waiting for test results with detailed logs  
**🔬 Next:** Analyze logs to identify root cause if still failing
