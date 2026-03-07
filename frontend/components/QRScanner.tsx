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
      streamRef.current.getTracks().forEach((track) => track.stop());
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
      const url = new URL(data);
      const museum_id = url.searchParams.get("museum") || undefined;
      const exhibit_id =
        url.searchParams.get("exhibit") ||
        url.searchParams.get("artifact") ||
        undefined;

      onScan({ museum_id, exhibit_id, artifact_id: exhibit_id });
    } catch {
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{
          background: "rgba(10,10,10,0.96)",
          borderBottom: "1px solid rgba(201,168,76,0.15)",
        }}
      >
        <h2
          className="text-lg font-semibold"
          style={{ color: "#F5F0E8", fontFamily: "DM Sans" }}
        >
          {t(language, "camera.scan_qr_title")}
        </h2>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="w-9 h-9 rounded-lg text-xl flex items-center justify-center"
          style={{
            color: "#C9A84C",
            background: "#111111",
            border: "1px solid rgba(201,168,76,0.15)",
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative" style={{ backgroundColor: "#0A0A0A" }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline />

        <canvas ref={canvasRef} className="hidden" />

        {/* Subtle dark overlay for contrast */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.72) 100%)" }}
        />

        {/* Scan Frame Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-64 h-64 rounded-lg relative"
            style={{ border: "2px solid rgba(201,168,76,0.75)", boxShadow: "0 0 0 1px rgba(0,0,0,0.35) inset" }}
          >
            <div className="absolute -top-1 -left-1 w-8 h-8" style={{ borderTop: "3px solid #C9A84C", borderLeft: "3px solid #C9A84C" }} />
            <div className="absolute -top-1 -right-1 w-8 h-8" style={{ borderTop: "3px solid #C9A84C", borderRight: "3px solid #C9A84C" }} />
            <div className="absolute -bottom-1 -left-1 w-8 h-8" style={{ borderBottom: "3px solid #C9A84C", borderLeft: "3px solid #C9A84C" }} />
            <div className="absolute -bottom-1 -right-1 w-8 h-8" style={{ borderBottom: "3px solid #C9A84C", borderRight: "3px solid #C9A84C" }} />

            {isScanning && (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="w-full h-1 animate-scan-line"
                  style={{ background: "linear-gradient(to right, transparent, #C9A84C, transparent)" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div
        className="p-6 text-center"
        style={{
          background: "#111111",
          borderTop: "1px solid rgba(201,168,76,0.15)",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        {error ? (
          <p className="text-sm" style={{ color: "#f87171", fontFamily: "DM Sans" }}>
            {error}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "#F5F0E8", fontFamily: "DM Sans" }}>
            {t(language, "camera.scan_qr_hint")}
          </p>
        )}
      </div>

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
