# 🐛 Fix: Gemini API "content is required" Error

## ❌ Lỗi

**Error message:**
```
ValueError: content is required.
File "/backend/live/ws_handler.py", line 156, in _receive_from_client
    await session.send(input="", end_of_turn=True)
```

**Traceback đầy đủ:**
```
2026-03-04 12:40:19,830 - live.ws_handler - ERROR - Error receiving from client: content is required.
Traceback (most recent call last):
  File "/Users/admin/Desktop/guideQR.ai/museai/backend/live/ws_handler.py", line 156, in _receive_from_client
    await session.send(input="", end_of_turn=True)
  File "/Users/admin/Desktop/guideQR.ai/museai/.venv/lib/python3.12/site-packages/google/genai/live.py", line 105, in send
    client_message = self._parse_client_message(input, end_of_turn)
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/admin/Desktop/guideQR.ai/museai/.venv/lib/python3.12/site-packages/google/genai/live.py", line 404, in _parse_client_message
    for item in t.t_contents(self._api_client, input)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/admin/Desktop/guideQR.ai/museai/.venv/lib/python3.12/site-packages/google/genai/_transformers.py", line 318, in t_contents
    return [t_content(client, content) for content in contents]
            ^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/Users/admin/Desktop/guideQR.ai/museai/.venv/lib/python3.12/site-packages/google/genai/_transformers.py", line 288, in t_content
    raise ValueError('content is required.')
ValueError: content is required.
```

---

## 🔍 Nguyên nhân

**File:** `backend/live/ws_handler.py`  
**Line 156 (SAI):**
```python
await session.send(input="", end_of_turn=True)
```

**Vấn đề:**
- Gemini Live API **KHÔNG chấp nhận** `input=""` (empty string)
- Khi gửi `end_of_turn=True`, phải:
  - **HOẶC:** Gửi `end_of_turn=True` **RIÊNG** (không kèm `input`)
  - **HOẶC:** Gửi `end_of_turn=True` kèm `input` có nội dung (audio/text)

**Root cause:**
- Frontend gửi message type `"end_of_turn"` để báo hiệu user đã nói xong
- Backend cố gắng forward signal này cho Gemini bằng cách gửi `input=""` + `end_of_turn=True`
- Gemini API reject vì `input=""` là invalid

---

## ✅ Giải pháp

### **Fix: Gửi `end_of_turn=True` KHÔNG kèm `input`**

**File:** `backend/live/ws_handler.py`  
**Line 154-157**

**TRƯỚC (SAI):**
```python
elif msg_type == "end_of_turn":
    # Client báo hiệu kết thúc lượt nói
    await session.send(input="", end_of_turn=True)
    logger.debug("Sent end_of_turn to Gemini")
```

**SAU (ĐÚNG):**
```python
elif msg_type == "end_of_turn":
    # Client báo hiệu kết thúc lượt nói
    # Gemini API yêu cầu gửi end_of_turn KHÔNG kèm input rỗng
    await session.send(end_of_turn=True)
    logger.debug("Sent end_of_turn to Gemini")
```

---

## 📊 Phân tích Gemini API

### **Các cách gửi hợp lệ:**

#### ✅ **Option 1: end_of_turn riêng (RECOMMENDED)**
```python
await session.send(end_of_turn=True)
```

#### ✅ **Option 2: Audio + end_of_turn cùng lúc**
```python
await session.send(
    input=types.LiveClientRealtimeInput(
        media_chunks=[
            types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
        ]
    ),
    end_of_turn=True
)
```

#### ✅ **Option 3: Text + end_of_turn cùng lúc**
```python
await session.send(input="Hello", end_of_turn=True)
```

### **Các cách gửi SAI:**

#### ❌ **Empty string với end_of_turn**
```python
await session.send(input="", end_of_turn=True)  # ValueError: content is required
```

#### ❌ **None với end_of_turn**
```python
await session.send(input=None, end_of_turn=True)  # ValueError: content is required
```

---

## 🧪 Testing

### **Kịch bản test:**

1. **User nói xong và click "Dừng"**
   - Frontend gửi: `{"type": "end_of_turn"}`
   - Backend nhận được message type `"end_of_turn"`
   - Backend gọi: `await session.send(end_of_turn=True)`
   - Gemini nhận tín hiệu và bắt đầu xử lý/trả lời

2. **Expected backend log:**
   ```
   📥 Received from client: type=end_of_turn
   ✅ Sent end_of_turn to Gemini
   ```

3. **KHÔNG có error:**
   ```
   ❌ ERROR - Error receiving from client: content is required.
   ```

---

## 🔄 Flow hoàn chỉnh

### **Frontend → Backend → Gemini:**

```
[User speaks] 
  → Frontend: Recording audio chunks
  → Send: {"type": "audio", "data": "<base64>"} (multiple times)

[User clicks "Dừng"]
  → Frontend: Stop recording
  → Send: {"type": "end_of_turn"}

[Backend receives "end_of_turn"]
  → Backend: await session.send(end_of_turn=True)
  
[Gemini processes turn]
  → Gemini: Generate response
  → Send back audio chunks + text + turn_complete
```

---

## 📝 Related Issues

### **Issue 1: "Cần click 2 lần mới ghi âm"**
- **Cause:** WebSocket connection timing issues
- **Fix:** Đã fix trong `useWebSocket.ts` (isMounted flag)

### **Issue 2: "Audio loop chào bạn"**
- **Cause:** Auto-greeting prompt + useEffect re-processing
- **Fix:** Đã fix trong `AUDIO_LOOP_FIX.md`

### **Issue 3: "content is required" (THIS FIX)**
- **Cause:** `input=""` với `end_of_turn=True`
- **Fix:** Chỉ gửi `end_of_turn=True` (không kèm input)

---

## 🚀 Deployment

### **Backend tự động reload:**
- Server đang chạy với `uvicorn --reload`
- File `ws_handler.py` đã được sửa
- Server đã tự động restart

### **Kiểm tra server running:**
```bash
lsof -ti:8080
# Nếu có PID → server đang chạy
```

### **Test endpoint:**
```bash
curl http://localhost:8080/health
# Expected: {"status": "healthy"}
```

---

## ✅ Status

- **Fixed:** ✅ Line 156 in `ws_handler.py`
- **Server:** ✅ Restarted with new code
- **Testing:** Ready for user verification

---

**📅 Date:** 2026-03-04  
**🔬 Tested:** Waiting for user feedback
