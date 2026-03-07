"use client";

import { useState, useRef, useEffect } from "react";
import jsQR from "jsqr";
import { t } from "@/lib/i18n";
import { LanguageCode } from "@/lib/constants";

type Props = {
  onScan: (data: { museum_id?: string; exhibit_id?: string; artifact_id?: string }) => void;
  onClose: () => void;
  language: LanguageCode;
};

export default function QRScanner({ onScan, onClose, language }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
        setIsScanning(true);
        scanQRCode();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError(t(language, "camera.permission_error"));
    }
  };

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsScanning(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      handleQRDetected(code.data);
      return;
    }

    animationRef.current = requestAnimationFrame(scanQRCode);
  };

  const handleQRDetected = (data: string) => {
    stopCamera();
    
    try {
      // Parse URL format:
      // - https://guideqr.ai?...&exhibit=yyy (new)
      // - https://guideqr.ai?...&artifact=yyy (legacy)
      const url = new URL(data);
      const museum_id = url.searchParams.get("museum") || undefined;
      const exhibit_id =
        url.searchParams.get("exhibit") ||
        url.searchParams.get("artifact") ||
        undefined;
      
      onScan({ museum_id, exhibit_id, artifact_id: exhibit_id });
    } catch (e) {
      // Fallback: plain text format like "museum_id:exhibit_id"
      const parts = data.split(":");
      if (parts.length === 2) {
        onScan({ museum_id: parts[0], exhibit_id: parts[1], artifact_id: parts[1] });
      } else if (parts.length === 1) {
        onScan({ exhibit_id: parts[0], artifact_id: parts[0] });
      } else {
        setError(t(language, "camera.invalid_qr"));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 p-4 flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold">{t(language, "camera.scan_qr_title")}</h2>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="text-white text-2xl"
        >
          ✕
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
        />
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan Frame Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border-4 border-blue-500 rounded-lg relative">
            {/* Corner Indicators */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
            
            {/* Scanning Line */}
            {isScanning && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="w-full h-1 bg-blue-500 animate-scan-line"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-slate-900 p-6 text-center">
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : (
          <p className="text-gray-300 text-sm">
            {t(language, "camera.scan_qr_hint")}
          </p>
        )}
      </div>

      {/* CSS for scan line animation */}
      <style jsx>{`
        @keyframes scan-line {
          0% { transform: translateY(0); }
          100% { transform: translateY(256px); }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
