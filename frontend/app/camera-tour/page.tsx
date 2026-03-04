"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";
import QRScanner from "@/components/QRScanner";

type State = "scanning" | "processing" | "detected" | "error";

type DetectedArtifact = {
  artifact_id: string;
  name: string;
  era?: string;
  location?: string;
  confidence: number;
};

export default function CameraTourPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, changeLanguage } = useLanguage();
  
  const [state, setState] = useState<State>("scanning");
  const [detected, setDetected] = useState<DetectedArtifact | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const museumId = searchParams.get('museum') || localStorage.getItem('museum_id') || 'demo_museum';

  const LANGUAGE_FLAGS: Record<string, string> = {
    vi: "🇻🇳",
    en: "🇬🇧",
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
        alert("Không thể truy cập camera. Vui lòng cấp quyền.");
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
    if (!videoRef.current || state === "processing") return;
    
    setState("processing");
    
    try {
      // Capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setState("error");
          setTimeout(() => setState("scanning"), 2000);
          return;
        }
        
        // Call API
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');
        
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/vision/recognize/${museumId}`, {
            method: 'POST',
            body: formData,
          });
          
          const result = await response.json();
          
          if (result.found && result.confidence >= 0.5) {
            setDetected({
              artifact_id: result.artifact_id,
              name: result.artifact_name || "Hiện vật",
              era: result.era,
              location: result.location,
              confidence: result.confidence,
            });
            setState("detected");
          } else {
            setState("error");
            setTimeout(() => setState("scanning"), 2000);
          }
        } catch (error) {
          console.error("Recognition error:", error);
          setState("error");
          setTimeout(() => setState("scanning"), 2000);
        }
      }, 'image/jpeg', 0.8);
      
    } catch (error) {
      console.error("Capture error:", error);
      setState("error");
      setTimeout(() => setState("scanning"), 2000);
    }
  };

  const handleExplore = () => {
    if (!detected) return;
    router.push(`/artifact/${detected.artifact_id}`);
  };

  const handleQRScan = (data: { museum_id?: string; artifact_id?: string }) => {
    setShowQRScanner(false);
    
    if (data.artifact_id) {
      router.push(`/artifact/${data.artifact_id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4"
           style={{
             background: 'linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, transparent 100%)'
           }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-[var(--gold)] text-xl">MuseAI</div>
            <div className="text-xs opacity-60" style={{ fontFamily: 'DM Sans' }}>
              {museumId === 'demo_museum' ? 'Bảo tàng Demo' : museumId}
            </div>
          </div>
          
          {/* Compact Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl transition-all hover:brightness-110"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
              {LANGUAGE_FLAGS[language] || "🌐"}
            </button>
            
            {/* Language dropdown */}
            {showLangMenu && (
              <div className="absolute right-0 top-12 rounded-xl overflow-hidden shadow-xl"
                   style={{
                     background: 'rgba(20,20,20,0.98)',
                     border: '1px solid rgba(255,255,255,0.1)',
                   }}>
                {Object.entries(LANGUAGE_FLAGS).map(([lang, flag]) => (
                  <button
                    key={lang}
                    onClick={() => { changeLanguage(lang); setShowLangMenu(false); }}
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

        {/* Viewfinder box — FIXED SIZE 260x260, centered */}
        <div style={{
          position: 'relative',
          width: '260px',
          height: '260px',
          minWidth: '260px',
          minHeight: '260px',
          flexShrink: 0,
          zIndex: 2,
        }}>
          {/* Corner TL */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 32,
            height: 32,
            borderTop: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
            borderLeft: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
          }} />
          
          {/* Corner TR */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 32,
            height: 32,
            borderTop: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
            borderRight: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
          }} />
          
          {/* Corner BL */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 32,
            height: 32,
            borderBottom: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
            borderLeft: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
          }} />
          
          {/* Corner BR */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 32,
            height: 32,
            borderBottom: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
            borderRight: `2px solid ${state === 'detected' ? '#4ade80' : '#C9A84C'}`,
          }} />

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
            ) : state === 'detected' ? (
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
                <div style={{ fontSize: 28, opacity: 0.35 }}>🏛️</div>
                <div style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'rgba(245,240,232,0.4)',
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
             background: 'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.8) 100%)'
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
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
          📱
        </button>
      </div>

      {/* Detected Card */}
      {state === "detected" && detected && (
        <div className="fixed inset-0 z-30 flex items-end animate-slideUp"
             style={{ background: 'rgba(0,0,0,0.7)' }}
             onClick={() => setState("scanning")}>
          <div className="w-full p-6 rounded-t-3xl"
               style={{ background: 'rgba(10,10,10,0.98)', borderTop: '1px solid var(--gold-dim)' }}
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
        />
      )}

      {/* Scan animation CSS */}
      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 0; opacity: 0; }
          50% { top: 50%; opacity: 1; }
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
