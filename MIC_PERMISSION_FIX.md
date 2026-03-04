# 🎤 FIX: Microphone Permission Error

## 🐛 Lỗi

**Error message:**
```
Không thể truy cập microphone. Vui lòng cấp quyền.
```

---

## ✅ QUICK FIX (Most Common)

### **Step 1: Đảm bảo dùng đúng URL**

```
✅ ĐÚNG: http://localhost:3002
✅ ĐÚNG: http://127.0.0.1:3002
❌ SAI: http://192.168.x.x:3002
❌ SAI: http://<your-computer-name>:3002
```

**Browser chỉ cho phép mic trên:**
- `localhost` hoặc `127.0.0.1`
- HTTPS domains
- **KHÔNG** cho phép trên IP LAN hoặc hostname khác

---

### **Step 2: Reset Mic Permission**

#### **Chrome / Edge:**
1. Click icon 🔒 (lock) bên trái address bar
2. Tìm "Microphone"
3. Chọn "Allow"
4. **Hard refresh:** `Cmd+Shift+R` (Mac) hoặc `Ctrl+Shift+R` (Windows)

#### **Safari:**
1. Safari menu → Settings (⌘,)
2. Tab "Websites"
3. Sidebar: "Microphone"
4. Tìm `localhost` hoặc `127.0.0.1`
5. Dropdown: Chọn "Allow"
6. Reload page: `Cmd+R`

#### **Firefox:**
1. Click icon 🔒 (lock)
2. "Connection secure" → "More Information"
3. Tab "Permissions"
4. "Use the Microphone"
5. ✅ Check "Allow"
6. Close dialog, reload: `Cmd+R`

---

### **Step 3: Check System Permissions (Mac)**

1. Apple menu  → System Settings
2. **Privacy & Security** → **Microphone**
3. Tìm browser của bạn (Chrome, Safari, Firefox)
4. **Toggle ON** nếu đang OFF
5. Quit & reopen browser
6. Test lại

---

### **Step 4: Check Mic không bị app khác dùng**

**Mac - Check processes:**
```bash
lsof | grep -i coreaudio
```

**Common culprits:**
- Zoom, Teams, Google Meet đang chạy
- Tab browser khác đang dùng mic
- OBS Studio, QuickTime recording
- Voice memos app

**Fix:** Đóng app, reload page

---

## 🔧 ADVANCED FIXES

### **Fix 1: Clear Browser Cache & Data**

**Chrome:**
1. Settings → Privacy and Security
2. Clear browsing data
3. Time range: "All time"
4. Check: ✅ Cookies, ✅ Site settings
5. Clear data
6. Restart browser

---

### **Fix 2: Test Mic Hoạt Động**

**Quick test:**
```
Open: https://www.onlinemictest.com/
Click "Allow"
Speak → Should see green bars
```

**Nếu KHÔNG hoạt động:**
- Mic bị hỏng
- Mic bị mute (check System Settings → Sound → Input)
- Driver issue (rare)

---

### **Fix 3: Use Different Browser**

Nếu Chrome không work:
- ✅ Try Safari
- ✅ Try Firefox
- ✅ Try Edge

---

## 🚨 Error Messages & Fixes

### **"NotAllowedError: Permission denied"**
→ User đã click "Block"  
→ **Fix:** Reset permission (Step 2 above)

### **"NotFoundError: Requested device not found"**
→ Không có mic nào được detect  
→ **Fix:** 
- Plug in external mic
- Check System Settings → Sound → Input
- Restart computer

### **"NotReadableError: Could not start video source"**
→ Mic đang bị dùng bởi app khác  
→ **Fix:** Close other apps (Zoom, Teams, etc.)

### **"SecurityError: Only secure origins are allowed"**
→ Đang dùng HTTP trên domain không phải localhost  
→ **Fix:** Dùng `http://localhost:3002`

---

## 🔍 Debug Steps

### **Check Console Errors:**

Open browser console (F12), look for:

```javascript
// GOOD:
🎤 Continuous streaming started (VAD mode)

// BAD:
Failed to start continuous recording: DOMException: Permission denied
```

### **Check Network Tab:**

1. F12 → Network tab
2. Filter: WS (WebSocket)
3. Should see: `ws://localhost:8080/ws/persona/...`
4. Status: `101 Switching Protocols`

If no WebSocket → Backend issue, not mic issue

---

## 📱 Mobile Testing (Optional)

**iOS Safari:**
- Settings → Safari → Microphone → "Ask"
- Visit page, tap "Allow" when prompted

**Android Chrome:**
- Settings → Site Settings → Microphone
- Find localhost → "Allow"

---

## ✅ Success Checklist

After following fixes:

```
[ ] Using http://localhost:3002 or http://127.0.0.1:3002
[ ] Browser permission = "Allow"
[ ] System permission = ON (Mac: System Settings → Microphone)
[ ] No other app using mic
[ ] Browser console shows: "🎤 Continuous streaming started"
[ ] Green pulse appears with "Đang lắng nghe..."
```

---

## 🎯 Still Not Working?

### **Last Resort:**

1. **Restart everything:**
   ```bash
   # Kill backend
   lsof -ti:8080 | xargs kill -9
   
   # Kill frontend
   lsof -ti:3002 | xargs kill -9
   
   # Restart backend
   cd backend && uvicorn main:app --reload --port 8080
   
   # Restart frontend (in another terminal)
   cd frontend && npm run dev
   ```

2. **Hard refresh browser:** `Cmd+Shift+R`

3. **Quit & reopen browser completely**

4. **Restart computer** (clears all permissions cache)

---

## 💡 Prevention

**To avoid this issue:**
- Always bookmark: `http://localhost:3002/artifact/statue_tran_hung_dao`
- Never use IP address
- Don't click "Block" when browser asks for mic permission
- Keep browser updated

---

**📅 Date:** 2026-03-04  
**✅ Status:** Microphone troubleshooting guide complete
