"use client";

import { useState, useRef, useEffect } from "react";
import jsQR from "jsqr";
import { t } from "@/lib/i18n";
import { LanguageCode } from "@/lib/constants";

export type QRScanPayload = {
  museum_id?: string;
  exhibit_id?: string;
  artifact_id?: string;
  error?: "non_system" | "invalid" | "unreadable";
};

type Props = {
  onScan: (data: QRScanPayload) => void;
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
  const scanningRef = useRef(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    scanningRef.current = false;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsScanning(false);
  };

  const parseMuseQr = (raw: string): QRScanPayload => {
    const looksLikeUrl = raw.includes("://") || raw.startsWith("/");
    if (looksLikeUrl) {
      try {
        const base = typeof window !== "undefined" ? window.location.origin : "https://guideqr.ai";
        const url = new URL(raw, base);
      const allowedHosts = new Set([
        "guideqr.ai",
        "www.guideqr.ai",
        "localhost",
        "127.0.0.1",
      ]);
      if (typeof window !== "undefined" && window.location.hostname) {
        allowedHosts.add(window.location.hostname);
      }
      if (!allowedHosts.has(url.hostname)) {
        return { error: "non_system" };
      }

      const isSupportedPath = /^\/(welcome|exhibit)(\/|$)/i.test(url.pathname);
      const museumId = url.searchParams.get("museum") || undefined;
      const exhibitId =
        url.searchParams.get("exhibit") ||
        url.searchParams.get("artifact") ||
        undefined;

      // Support direct path: /exhibit/{id}
      const pathMatch = url.pathname.match(/\/exhibit\/([^/?#]+)/i);
      const exhibitFromPath = pathMatch?.[1];

      if (!isSupportedPath && !museumId && !exhibitId && !exhibitFromPath) {
        return { error: "non_system" };
      }

      if (museumId || exhibitId || exhibitFromPath) {
        const resolvedExhibitId = exhibitId || exhibitFromPath;
        return {
          museum_id: museumId,
          exhibit_id: resolvedExhibitId,
          artifact_id: resolvedExhibitId,
        };
      }

      return { error: "non_system" };
      } catch {
        return { error: "invalid" };
      }
    }

    // Fallback plain text: museum_id:exhibit_id OR exhibit_id
    const parts = raw.split(":").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      return { museum_id: parts[0], exhibit_id: parts[1], artifact_id: parts[1] };
    }
    if (parts.length === 1) {
      return { exhibit_id: parts[0], artifact_id: parts[0] };
    }
    return { error: "invalid" };
  };

  const handleQRDetected = (decodedText: string) => {
    console.log("QR decoded:", decodedText);
    stopCamera();

    const parsed = parseMuseQr(decodedText);

    if (parsed.error === "non_system") {
      setError(t(language, "camera.qr_not_museai"));
      onScan({ error: "non_system" });
      return;
    }

    if (parsed.error) {
      setError(t(language, "camera.invalid_qr"));
      onScan({ error: parsed.error });
      return;
    }

    onScan(parsed);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !scanningRef.current) return;

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

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        handleQRDetected(code.data);
        return;
      }
    } catch (err) {
      console.error("QR read error:", err);
      setError(t(language, "camera.qr_read_failed"));
      onScan({ error: "unreadable" });
      stopCamera();
      return;
    }

    animationRef.current = requestAnimationFrame(scanQRCode);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      streamRef.current = stream;
      scanningRef.current = true;
      setIsScanning(true);
      scanQRCode();
    } catch (err) {
      console.error("Camera error:", err);
      setError(t(language, "camera.permission_error"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#0A0A0A" }}>
      <div
        className="p-4 flex items-center justify-between"
        style={{
          background: "rgba(10,10,10,0.96)",
          borderBottom: "1px solid rgba(201,168,76,0.15)",
        }}
      >
        <h2 className="text-lg font-semibold" style={{ color: "#F5F0E8", fontFamily: "DM Sans" }}>
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

      <div className="flex-1 relative" style={{ backgroundColor: "#0A0A0A" }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline />
        <canvas ref={canvasRef} className="hidden" />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.72) 100%)" }}
        />

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
                <div className="w-full h-1 animate-scan-line" style={{ background: "linear-gradient(to right, transparent, #C9A84C, transparent)" }} />
              </div>
            )}
          </div>
        </div>
      </div>

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
