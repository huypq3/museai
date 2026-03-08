"use client";

import { useState, useRef } from "react";
import { recognizeExhibit } from "@/lib/api";

type Props = {
  museumId: string;
  onExhibitDetected: (exhibitId: string, confidence: number) => void;
  onClose: () => void;
};

type DetectionResult = {
  exhibit_id: string;
  confidence: number;
  reasoning: string;
  found: boolean;
};

export default function CameraVision({ museumId, onExhibitDetected, onClose }: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Không thể truy cập camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Cannot get canvas context");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob"));
        }, "image/jpeg", 0.8);
      });

      // Create File from blob
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

      // Send to backend
      const response = await recognizeExhibit(museumId, file);
      
      setResult(response);

      if (response.found && response.confidence >= 0.5) {
        // Auto-navigate after 2s
        setTimeout(() => {
          onExhibitDetected(response.exhibit_id, response.confidence);
        }, 2000);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Không thể phân tích ảnh. Vui lòng thử lại.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Auto-start camera
  if (!streamRef.current && videoRef.current) {
    startCamera();
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 p-4 flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold">Nhận diện hiện vật</h2>
        <button onClick={handleClose} className="text-white text-2xl">
          ✕
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
        />
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Result Overlay */}
        {result && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center p-8">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
              {result.found ? (
                <>
                  <div className="text-center mb-4">
                    <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-white text-xl font-bold mb-2">
                      Đã nhận diện!
                    </h3>
                    <p className="text-gray-300 text-sm mb-2">
                      {result.reasoning}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-blue-400">
                      <span>Độ chính xác:</span>
                      <span className="font-bold">
                        {Math.round(result.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onExhibitDetected(result.exhibit_id, result.confidence)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition"
                  >
                    Bắt đầu trò chuyện
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="text-6xl mb-4">❓</div>
                    <h3 className="text-white text-xl font-bold mb-2">
                      Không nhận diện được
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {result.reasoning}
                    </p>
                  </div>
                  <button
                    onClick={captureAndAnalyze}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition"
                  >
                    Thử lại
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center p-8">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  captureAndAnalyze();
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Capture Button */}
      {!isAnalyzing && !result && !error && (
        <div className="bg-slate-900 p-6 flex flex-col items-center" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={captureAndAnalyze}
            className="w-20 h-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition transform active:scale-95"
          >
            <span className="text-4xl">📷</span>
          </button>
          <p className="text-gray-300 text-sm mt-4">
            Hướng camera vào hiện vật và chụp ảnh
          </p>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="bg-slate-900 p-6 flex flex-col items-center" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white">Đang phân tích...</p>
        </div>
      )}
    </div>
  );
}
