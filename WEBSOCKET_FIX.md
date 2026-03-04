# WebSocket Fix - Voice Chat Issue

## 🐛 Problem

WebSocket connection kept closing immediately after connecting:
```
WebSocket connected
WebSocket closed
Reconnecting...
```

User couldn't speak or get AI responses.

## 🐛 Root Causes

### 1. Backend: Wrong async pattern
**File**: `backend/live/ws_handler.py`
**Issue**: Used `asyncio.wait(..., FIRST_COMPLETED)` which cancels one task when the other completes. Both tasks need to run simultaneously.

**Fix**:
```python
# Before: WRONG
done, pending = await asyncio.wait(
    [receive_task, send_task],
    return_when=asyncio.FIRST_COMPLETED  # ❌ Kills one task!
)

# After: CORRECT
await asyncio.gather(receive_task, send_task)  # ✅ Both run together
```

### 2. Backend: Wrong API parameter
**File**: `backend/live/ws_handler.py`
**Issue**: `system_instruction` passed as parameter to `connect()`, but API expects it in `config` dict.

**Fix**:
```python
# Before: WRONG
async with self.client.aio.live.connect(
    model="...",
    config={"response_modalities": ["AUDIO"]},
    system_instruction=system_instruction_content  # ❌
)

# After: CORRECT
config = {
    "response_modalities": ["AUDIO"],
    "system_instruction": system_instruction_content  # ✅ Inside config
}
async with self.client.aio.live.connect(
    model="...",
    config=config
)
```

### 2. Frontend: Auto-reconnect on normal close
**File**: `frontend/hooks/useWebSocket.ts`
**Issue**: Reconnected even on normal closures (code 1000), causing infinite loop.

**Fix**:
```typescript
// Before: WRONG
socket.onclose = () => {
  // Always reconnect ❌
  setTimeout(() => connect(), 3000);
};

// After: CORRECT
socket.onclose = (event) => {
  // Only reconnect on abnormal close ✅
  if (event.code !== 1000 && event.code !== 1001) {
    setTimeout(() => connect(), 3000);
  }
};
```

### 3. Frontend: Message type mismatch
**File**: `frontend/components/VoiceChat.tsx`
**Issue**: 
- Backend sends: `{ type: "audio", data: "..." }`
- Frontend expects: `{ type: "audio_chunk", audio: "..." }`

**Fix**:
```typescript
// Before: WRONG
if (msg.type === "audio_chunk" && msg.audio) {  // ❌
  playChunk(msg.audio);
}

// After: CORRECT
if (msg.type === "audio" && msg.data) {  // ✅
  playChunk(msg.data);
}
```

## ✅ Changes Made

### Backend (`backend/live/ws_handler.py`)
1. ✅ Added "ready" message after connection
2. ✅ Changed `asyncio.wait()` to `asyncio.gather()`
3. ✅ Improved error handling
4. ✅ **CRITICAL FIX**: Moved `system_instruction` into `config` dict (API requirement)

### Frontend (`frontend/hooks/useWebSocket.ts`)
1. ✅ Check close code before reconnecting
2. ✅ Only reconnect on abnormal closures

### Frontend (`frontend/components/VoiceChat.tsx`)
1. ✅ Handle "ready" message type
2. ✅ Changed `audio_chunk` → `audio`
3. ✅ Changed `msg.audio` → `msg.data`
4. ✅ Changed `msg.text` → `msg.data`
5. ✅ Changed outgoing audio type: `{ type: "audio", data: base64 }`

## 🧪 Testing

### Before Fix
```
❌ WebSocket: Connects then immediately closes
❌ Voice: Cannot record or receive audio
❌ State: Stuck in "connecting" loop
```

### After Fix
```
✅ WebSocket: Stays connected
✅ Voice: Can record and send audio
✅ State: idle → connecting → ready → listening → ai_speaking
✅ Backend: Receives audio chunks
✅ Frontend: Receives audio responses
```

## 📝 How to Test

### 1. Restart Backend
```bash
cd backend
source ../.venv/bin/activate
export GRPC_DNS_RESOLVER=native
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret="gemini-api-key" --project=museai-2026)
uvicorn main:app --reload --port 8080
```

### 2. Refresh Frontend
```
http://localhost:3002/artifact/statue_tran_hung_dao
```

### 3. Test Flow
1. Click "🎤 Bắt đầu"
2. Wait for "Hãy hỏi về hiện vật này"
3. Click "🎤 Nhấn để nói"
4. Speak into microphone
5. Click "✋ Dừng"
6. Wait for AI response

### Expected Console Output
```
Connecting to: ws://localhost:8080/ws/persona/statue_tran_hung_dao?language=vi
WebSocket connected
Backend ready
(no more "WebSocket closed" messages)
```

## 🔧 Additional Notes

### Audio Format Issue (Still Exists)
MediaRecorder sends WebM format, but Gemini Live expects PCM 16kHz mono.

**Current status**: Backend accepts it but may not process correctly.

**Future fix needed**: Convert WebM → PCM in browser using AudioContext:
```typescript
// TODO: Convert audio format
const audioContext = new AudioContext({ sampleRate: 16000 });
// Decode WebM → AudioBuffer → PCM Int16Array
```

### Message Flow
```
User → Frontend:
  { type: "audio", data: "base64..." }

Frontend → Backend:
  { type: "audio", data: "base64..." }

Backend → Gemini:
  types.Part(inline_data=types.Blob(mime_type="audio/pcm", data=bytes))

Gemini → Backend:
  turn.parts[].inline_data.data (audio bytes)

Backend → Frontend:
  { type: "audio", data: "base64...", mime_type: "..." }

Frontend → AudioPlayer:
  playChunk(base64)
```

## ✅ Fix Summary

| Issue | Status | File |
|-------|--------|------|
| Backend async pattern | ✅ Fixed | `backend/live/ws_handler.py` |
| Frontend auto-reconnect | ✅ Fixed | `frontend/hooks/useWebSocket.ts` |
| Message type mismatch | ✅ Fixed | `frontend/components/VoiceChat.tsx` |
| Audio format conversion | ⚠️ Pending | Multiple files |

## 🚀 Result

WebSocket now **stays connected** and both directions work:
- ✅ Client can send audio to backend
- ✅ Backend can send audio to client
- ✅ No more infinite reconnect loop
- ✅ State transitions work correctly

---

**Fixed**: March 4, 2026
**Time to Fix**: ~15 minutes
**Files Modified**: 3 files
