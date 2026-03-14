"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";
import { BACKEND_URL, LanguageCode } from "@/lib/constants";
import QRScanner, { QRScanPayload } from "@/components/QRScanner";
import { trackEvent } from "@/lib/analytics";
import { createExhibitSession, validateMuseum } from "@/lib/api";
import MuseAILogo from "@/components/MuseAILogo";

type State = "scanning" | "processing" | "detected" | "error";

type DetectedExhibit = {
  exhibit_id: string;
  name: string;
  era?: string;
  location?: string;
  confidence: number;
};

export default function CameraTourPage() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();
  
  const [state, setState] = useState<State>("scanning");
  const [isLockOnAnimating, setIsLockOnAnimating] = useState(false);
  const [detected, setDetected] = useState<DetectedExhibit | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [museumId, setMuseumId] = useState("demo_museum");
  const [museumName, setMuseumName] = useState<string>(t(language, "camera.demo_museum"));
  const [museumValidated, setMuseumValidated] = useState(false);
  const [museumData, setMuseumData] = useState<{ id: string; name?: string; name_en?: string } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousStateRef = useRef<State>("scanning");
  
  useEffect(() => {
    let mounted = true;

    async function initMuseum() {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("museum");
      const fromLocal = localStorage.getItem("museum_id");
      const resolved = fromQuery || fromLocal;

      if (!resolved) {
        router.replace("/error?code=MUSEUM_REQUIRED");
        return;
      }

      try {
        const museum = await validateMuseum(resolved);
        if (!mounted) return;

        setMuseumId(museum.id);
        localStorage.setItem("museum_id", museum.id);
        setMuseumData({ id: museum.id, name: museum.name, name_en: museum.name_en });
        setMuseumValidated(true);
        trackEvent("camera_opened", museum.id);
      } catch {
        if (!mounted) return;
        router.replace("/error?code=MUSEUM_NOT_FOUND");
      }
    }

    initMuseum();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!museumData) return;
    setMuseumName(
      language === "en"
        ? museumData.name_en || museumData.name || museumData.id
        : museumData.name || museumData.name_en || museumData.id
    );
  }, [language, museumData]);

  useEffect(() => {
    const previousState = previousStateRef.current;

    if (previousState === "processing" && state === "detected") {
      setIsLockOnAnimating(true);
      const timer = window.setTimeout(() => setIsLockOnAnimating(false), 350);
      previousStateRef.current = state;
      return () => window.clearTimeout(timer);
    }

    if (state !== "detected") {
      setIsLockOnAnimating(false);
    }

    previousStateRef.current = state;
  }, [state]);

  const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
    vi: "🇻🇳",
    en: "🇬🇧",
    de: "🇩🇪",
    ru: "🇷🇺",
    ar: "🇸🇦",
    es: "🇪🇸",
    fr: "🇫🇷",
    zh: "🇨🇳",
    ja: "🇯🇵",
    ko: "🇰🇷",
  };

  // Initialize camera
  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Camera error:", error);
        alert(t(language, "camera.permission_error"));
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || state === "processing" || !museumValidated) return;
    
    setState("processing");
    
    try {
      const video = videoRef.current;
      const sourceW = video.videoWidth;
      const sourceH = video.videoHeight;
      const renderW = video.clientWidth;
      const renderH = video.clientHeight;
      if (!sourceW || !sourceH || !renderW || !renderH) {
        setState("error");
        setTimeout(() => setState("scanning"), 2000);
        return;
      }

      // The on-screen viewfinder is a fixed 260x260 circle centered in the video area.
      const viewfinderPx = 260;
      const vfX = (renderW - viewfinderPx) / 2;
      const vfY = (renderH - viewfinderPx) / 2;

      // Map display coordinates to source video coordinates for object-fit: cover.
      const coverScale = Math.max(renderW / sourceW, renderH / sourceH);
      const displayedW = sourceW * coverScale;
      const displayedH = sourceH * coverScale;
      const offsetX = (renderW - displayedW) / 2;
      const offsetY = (renderH - displayedH) / 2;

      const rawSrcX = (vfX - offsetX) / coverScale;
      const rawSrcY = (vfY - offsetY) / coverScale;
      const rawSrcW = viewfinderPx / coverScale;
      const rawSrcH = viewfinderPx / coverScale;

      const srcX = Math.max(0, Math.min(sourceW - 1, rawSrcX));
      const srcY = Math.max(0, Math.min(sourceH - 1, rawSrcY));
      const srcW = Math.max(1, Math.min(sourceW - srcX, rawSrcW));
      const srcH = Math.max(1, Math.min(sourceH - srcY, rawSrcH));

      // Send a normalized square crop; apply a circular mask so model focuses on viewfinder area.
      const targetSize = 640;
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setState("error");
        setTimeout(() => setState("scanning"), 2000);
        return;
      }

      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, targetSize, targetSize);
      ctx.globalCompositeOperation = "destination-in";
      ctx.beginPath();
      ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
      });
      if (!blob) {
        setState("error");
        setTimeout(() => setState("scanning"), 2000);
        return;
      }

      const formData = new FormData();
      formData.append("file", blob, "viewfinder-crop.jpg");

      try {
        const response = await fetch(`${BACKEND_URL}/vision/recognize/${museumId}`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.found && result.confidence >= 0.5) {
          trackEvent("exhibit_detected", museumId, result.exhibit_id, {
            confidence: result.confidence,
          });
          setDetected({
            exhibit_id: result.exhibit_id,
            name: result.exhibit_name || t(language, "camera.exhibit_fallback"),
            era: result.era,
            location: result.location,
            confidence: result.confidence,
          });
          setState("detected");
          try {
            const session = await createExhibitSession(result.exhibit_id, museumId);
            router.push(session.redirect_url);
            return;
          } catch {
            alert("Unable to start session. Please try again.");
            setState("scanning");
            return;
          }
        } else {
          setState("error");
          setTimeout(() => setState("scanning"), 2000);
        }
      } catch (error) {
        console.error("Recognition error:", error);
        setState("error");
        setTimeout(() => setState("scanning"), 2000);
      }
      
    } catch (error) {
      console.error("Capture error:", error);
      setState("error");
      setTimeout(() => setState("scanning"), 2000);
    }
  };

  const handleExplore = async () => {
    if (!detected) return;
    try {
      const data = await createExhibitSession(detected.exhibit_id, museumId);
      router.push(data.redirect_url);
    } catch {
      alert("Unable to start session. Please try again.");
    }
  };

  const handleQRScan = async (data: QRScanPayload) => {
    if (data.error === "non_system") {
      setShowQRScanner(false);
      alert(t(language, "camera.qr_not_museai"));
      return;
    }

    if (data.error === "unreadable") {
      setShowQRScanner(false);
      alert(t(language, "camera.qr_read_failed"));
      return;
    }

    if (data.error) {
      setShowQRScanner(false);
      alert(t(language, "camera.invalid_qr"));
      return;
    }

    const exhibitId = data.exhibit_id || data.exhibit_id;
    if (exhibitId) {
      setShowQRScanner(false);
      const targetMuseumId = data.museum_id || museumId;
      if (targetMuseumId) {
        localStorage.setItem("museum_id", targetMuseumId);
        setMuseumId(targetMuseumId);
      }
      try {
        const session = await createExhibitSession(exhibitId, targetMuseumId);
        router.push(session.redirect_url);
      } catch {
        alert("Unable to start session. Please try again.");
      }
      return;
    }

    if (data.museum_id) {
      setShowQRScanner(false);
      try {
        const museum = await validateMuseum(data.museum_id);
        localStorage.setItem("museum_id", museum.id);
        setMuseumId(museum.id);
        setMuseumData({ id: museum.id, name: museum.name, name_en: museum.name_en });
        alert(t(language, "camera.qr_museum_only"));
      } catch {
        alert(t(language, "error.museum_not_found"));
      }
      return;
    }

    alert(t(language, "camera.invalid_qr"));
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4"
           style={{
             background: 'linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, transparent 100%)'
           }}>
        <div className="flex items-center justify-between">
          <div>
            <MuseAILogo variant="horizontal-compact" theme="dark" iconSize={28} />
            <div className="text-xs opacity-60" style={{ fontFamily: 'DM Sans' }}>
              {museumName || museumId}
            </div>
          </div>
          
          {/* Compact Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl transition-all hover:brightness-110"
              style={{
                background: 'rgba(17,17,17,0.88)',
                border: '1px solid rgba(201,168,76,0.15)',
              }}>
              {LANGUAGE_FLAGS[language] || "🌐"}
            </button>
            
            {/* Language dropdown */}
            {showLangMenu && (
              <div className="absolute right-0 top-12 rounded-xl overflow-hidden shadow-xl"
                   style={{
                     background: 'rgba(17,17,17,0.98)',
                     border: '1px solid rgba(201,168,76,0.15)',
                   }}>
                {Object.entries(LANGUAGE_FLAGS).map(([lang, flag]) => (
                  <button
                    key={lang}
                    onClick={() => {
                      trackEvent("language_changed", museumId, undefined, { from: language, to: lang });
                      changeLanguage(lang as LanguageCode);
                      setShowLangMenu(false);
                    }}
                    className="w-full px-4 py-2 flex items-center gap-3 hover:brightness-125 transition"
                    style={{
                      background: language === lang ? 'rgba(201,168,76,0.2)' : 'transparent',
                      fontFamily: 'DM Sans',
                      fontSize: '14px',
                    }}>
                    <span className="text-xl">{flag}</span>
                    <span style={{ color: 'var(--museum-white)' }}>
                      {lang.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Viewfinder — wrapper fills flex space */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: '60px',
      }}>
        {/* Camera video fill entire background */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Vignette overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)',
        }} />

        {/* Circular viewfinder — always visible from the first frame */}
        <div style={{
          position: 'relative',
          width: '260px',
          height: '260px',
          minWidth: '260px',
          minHeight: '260px',
          flexShrink: 0,
          zIndex: 2,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${state === 'detected' && !isLockOnAnimating ? '#4ade80' : '#C9A84C'}`,
          boxShadow: state === 'detected' && !isLockOnAnimating
            ? '0 0 0 1px rgba(74,222,128,0.35), 0 0 16px rgba(74,222,128,0.35)'
            : '0 0 0 1px rgba(201,168,76,0.25), 0 0 14px rgba(201,168,76,0.28)',
        }}>
          {/* Inner aiming circle (always visible) */}
          <div
            style={{
              position: "absolute",
              inset: "12%",
              borderRadius: "50%",
              border: `1px solid ${state === 'detected' && !isLockOnAnimating ? 'rgba(74,222,128,0.9)' : 'rgba(201,168,76,0.85)'}`,
              boxShadow: "0 0 8px rgba(201,168,76,0.2)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          {/* Scan line — only when scanning */}
          {state === 'scanning' && (
            <div style={{
              position: 'absolute',
              left: 4,
              right: 4,
              height: 1,
              background: 'linear-gradient(to right, transparent, #C9A84C, transparent)',
              animation: 'scanLine 2.5s ease-in-out infinite',
            }} />
          )}

          {isLockOnAnimating && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 236,
              height: 236,
              border: '3px solid #FFD700',
              opacity: 1,
              borderRadius: '50%',
              background: 'transparent',
              outline: '1px solid rgba(201, 168, 76, 0.4)',
              outlineOffset: 4,
              boxSizing: 'border-box',
              maxWidth: '100%',
              maxHeight: '100%',
              boxShadow: '0 0 0 1px rgba(201, 168, 76, 0.3), 0 0 12px rgba(201, 168, 76, 0.6), 0 0 24px rgba(201, 168, 76, 0.3)',
              animation: 'lockOn 0.35s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 3,
            }} />
          )}

          {/* Center content INSIDE viewfinder */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
            {state === 'processing' ? (
              <>
                <div style={{
                  width: 28,
                  height: 28,
                  border: '2px solid #C9A84C',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{
                  color: 'rgba(245,240,232,0.5)',
                  fontSize: 12,
                  fontFamily: 'DM Sans',
                }}>
                  {t(language, 'camera.processing')}
                </span>
              </>
            ) : state === 'detected' && !isLockOnAnimating ? (
              <div style={{ color: '#4ade80', fontSize: 36 }}>✓</div>
            ) : state === 'error' ? (
              <div style={{
                color: '#f87171',
                fontSize: 13,
                textAlign: 'center',
                padding: '0 12px',
                fontFamily: 'DM Sans',
              }}>
                {t(language, 'camera.retry')}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, color: '#C9A84C', opacity: 1, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>🏛️</div>
                <div style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: '#C9A84C',
                  opacity: 1,
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                  fontWeight: 600,
                  textAlign: 'center',
                  padding: '0 16px',
                  lineHeight: 1.4,
                }}>
                  {t(language, 'camera.hint')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="py-3 flex items-center justify-center gap-2"
           style={{ background: 'rgba(10,10,10,0.9)' }}>
        <div className={`w-2 h-2 rounded-full ${state === "scanning" ? "animate-pulse" : ""}`}
             style={{ background: state === "detected" ? "#4ade80" : "var(--gold)" }} />
        <span className="text-xs" style={{ fontFamily: 'DM Sans', color: 'var(--museum-dim)' }}>
          {state === "scanning" && t(language, 'camera.scanning')}
          {state === "processing" && t(language, 'camera.processing')}
          {state === "detected" && t(language, 'camera.detected_label')}
          {state === "error" && t(language, 'camera.retry')}
        </span>
      </div>

      {/* Footer controls */}
      <div className="p-4 flex gap-3"
           style={{
             background: 'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.8) 100%)',
             paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
           }}>
        <button
          onClick={handleCapture}
          disabled={state === "processing"}
          className="flex-1 px-6 py-3.5 rounded-[14px] font-medium text-[15px] transition-all disabled:opacity-50"
          style={{
            background: 'var(--gold)',
            color: 'var(--museum-dark)',
            fontFamily: 'DM Sans',
          }}>
          📷 {t(language, 'camera.capture')}
        </button>
        
        <button
          onClick={() => setShowQRScanner(true)}
          className="w-14 h-14 rounded-[14px] flex items-center justify-center text-xl transition-all"
          style={{
            background: '#111111',
            border: '1px solid rgba(201,168,76,0.15)',
          }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h5v2H6v3H4V4Zm11 0h5v5h-2V6h-3V4ZM4 15h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3ZM8 8h8v8H8V8Zm2 2v4h4v-4h-4Z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Detected Card */}
      {state === "detected" && !isLockOnAnimating && detected && (
        <div className="fixed inset-0 z-30 flex items-end animate-slideUp"
             style={{ background: 'rgba(0,0,0,0.7)' }}
             onClick={() => setState("scanning")}>
          <div className="w-full p-6 rounded-t-3xl"
               style={{ background: 'rgba(10,10,10,0.98)', borderTop: '1px solid var(--gold-dim)', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
               onClick={(e) => e.stopPropagation()}>
            
            <div className="text-[10px] tracking-[0.2em] uppercase mb-3"
                 style={{ color: 'var(--gold)', fontFamily: 'DM Sans' }}>
              ✦ {t(language, 'camera.detected_label')} · {Math.round(detected.confidence * 100)}%
            </div>
            
            <h2 className="font-display text-2xl mb-2"
                style={{ color: 'var(--museum-white)' }}>
              {detected.name}
            </h2>
            
            <p className="text-[13px] mb-4"
               style={{ color: 'var(--museum-dim)', fontFamily: 'DM Sans' }}>
              {detected.era && `${detected.era}`}
              {detected.location && ` · ${detected.location}`}
            </p>
            
            {/* Confidence bar */}
            <div className="h-0.5 bg-black/30 rounded-full mb-6 overflow-hidden">
              <div 
                className="h-full transition-all duration-1000"
                style={{ 
                  background: 'var(--gold)',
                  width: `${detected.confidence * 100}%`
                }} />
            </div>
            
            <button
              onClick={handleExplore}
              className="w-full px-6 py-4 rounded-[14px] font-medium text-[15px]"
              style={{
                background: 'var(--gold)',
                color: 'var(--museum-dark)',
                fontFamily: 'DM Sans',
              }}>
              {t(language, 'camera.explore')}
            </button>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
          language={language}
        />
      )}

      {/* Scan animation CSS */}
      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 0; opacity: 0; }
          50% { top: 50%; opacity: 1; }
        }
        @keyframes lockOn {
          0% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
