# 🎨 MuseAI UI Implementation - Progress

## ✅ Completed

### 1. **Global Setup**
- [x] Added Cormorant Garamond + DM Sans fonts to layout.tsx
- [x] Updated globals.css with museum theme CSS variables
- [x] Set dark museum aesthetic (#0A0A0A background, gold #C9A84C)

### 2. **Landing Page Redirect** (`app/page.tsx`)
- [x] Simplified to auto-redirect to `/welcome?museum=demo_museum`
- [x] Loading spinner while redirecting

### 3. **Welcome Page** (`app/welcome/page.tsx`)
- [x] Dark background with radial gradient
- [x] Noise texture overlay
- [x] Museum icon + name
- [x] "MuseAI" title in Cormorant Garamond
- [x] Tagline italic
- [x] Gold divider line
- [x] 3 instruction items with icons
- [x] Gold CTA button → `/camera-tour`
- [x] "Powered by Gemini" footer
- [x] Language selector top-right

## 🔄 In Progress

### 4. **Camera Tour Page** (`app/camera-tour/page.tsx`)
Need to create comprehensive camera recognition page with:
- Header with logo + museum name + language selector
- Full-screen camera viewfinder
- Canvas overlay with 4-corner brackets
- Scan line animation
- State indicators (scanning/processing/detected/error)
- Camera capture logic
- API integration with `/vision/recognize/{museum_id}`
- DetectedCard slide-up component
- Footer with capture + QR buttons

### 5. **Artifact Page** (`app/artifact/[id]/page.tsx`)
Need to update existing page:
- Replace header with compact museum-themed header
- Remove "Quay lại" text button
- Add camera icon button (top-left) → navigate to camera-tour
- Center: artifact name + era
- Right: flag emoji language selector
- Remove separate "Artifact Info" section

### 6. **VoiceChat Component** (`components/VoiceChat.tsx`)
Major refactor needed:
- Remove "idle" state entirely
- Auto-connect on mount (shouldConnect = true always)
- Remove "Bắt đầu" button
- New UI for "ready" state (no button, just text)
- Bottom controls: [📷] [🎤 mic flex-1] [✋]
- Camera button navigates to /camera-tour
- Interrupt button only visible when ai_speaking
- Custom wave visualizer (15 bars, gold/red colors)
- Match dark museum aesthetic

---

## 📋 Next Steps

1. Create `/app/camera-tour/page.tsx` (complex, needs camera logic)
2. Update `/app/artifact/[id]/page.tsx` (simpler UI changes)
3. Refactor `/components/VoiceChat.tsx` (major state machine changes)
4. Test full flow end-to-end
5. Take screenshots for documentation

---

**Current Status:** 3/6 components complete  
**Estimated Remaining:** 2-3 implementation cycles
