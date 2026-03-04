#!/usr/bin/env python3
"""
Sprint 5 - Next.js PWA Frontend Generator
Tạo toàn bộ frontend files cho MuseAI
"""

import os
import subprocess
import sys

# Base directory
BASE_DIR = "/Users/admin/Desktop/guideQR.ai/museai"
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

def run_command(cmd, cwd=None):
    """Chạy shell command."""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    return True

def create_file(path, content):
    """Tạo file với content."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Created: {path}")

def setup_nextjs():
    """Setup Next.js project."""
    print("\n📦 Setting up Next.js 14 project...")
    
    if os.path.exists(FRONTEND_DIR):
        print("⚠️  frontend/ already exists. Removing...")
        run_command(f"rm -rf {FRONTEND_DIR}")
    
    # Create Next.js project
    cmd = "npx create-next-app@14 frontend --typescript --tailwind --app --no-git --yes"
    if not run_command(cmd, cwd=BASE_DIR):
        print("Failed to create Next.js project")
        sys.exit(1)
    
    # Install dependencies
    print("\n📦 Installing dependencies...")
    run_command("npm install jsqr @zxing/library", cwd=FRONTEND_DIR)

def create_all_files():
    """Tạo tất cả files cần thiết."""
    
    print("\n📝 Creating all project files...")
    
    # ==================== LIB FILES ====================
    
    # lib/constants.ts
    create_file(os.path.join(FRONTEND_DIR, "lib/constants.ts"), '''export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
export const WS_BACKEND_URL = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://");

export const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export type LanguageCode = "vi" | "en" | "fr" | "ja" | "ko" | "zh";
''')

    # lib/api.ts
    create_file(os.path.join(FRONTEND_DIR, "lib/api.ts"), '''import { BACKEND_URL } from "./constants";

export async function getArtifact(artifactId: string) {
  const res = await fetch(`${BACKEND_URL}/artifacts/${artifactId}`);
  if (!res.ok) throw new Error("Failed to fetch artifact");
  return res.json();
}

export async function recognizeArtifact(museumId: string, imageFile: File) {
  const formData = new FormData();
  formData.append("file", imageFile);
  
  const res = await fetch(`${BACKEND_URL}/vision/recognize/${museumId}`, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) throw new Error("Failed to recognize artifact");
  return res.json();
}
''')

    # ==================== HOOKS ====================
    
    # hooks/useLanguage.ts
    create_file(os.path.join(FRONTEND_DIR, "hooks/useLanguage.ts"), '''import { useState, useEffect } from "react";
import { LanguageCode } from "@/lib/constants";

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageCode>("vi");
  const [isAutoDetected, setIsAutoDetected] = useState(true);

  useEffect(() => {
    // Check localStorage
    const saved = localStorage.getItem("language");
    if (saved) {
      setLanguage(saved as LanguageCode);
      setIsAutoDetected(false);
      return;
    }

    // Auto-detect from browser
    const browserLang = navigator.language.toLowerCase();
    let detected: LanguageCode = "en";

    if (browserLang.startsWith("vi")) detected = "vi";
    else if (browserLang.startsWith("fr")) detected = "fr";
    else if (browserLang.startsWith("ja")) detected = "ja";
    else if (browserLang.startsWith("ko")) detected = "ko";
    else if (browserLang.startsWith("zh")) detected = "zh";

    setLanguage(detected);
    setIsAutoDetected(true);
  }, []);

  const changeLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    setIsAutoDetected(false);
    localStorage.setItem("language", lang);
  };

  return { language, changeLanguage, isAutoDetected };
}
''')

    # hooks/useWebSocket.ts
    create_file(os.path.join(FRONTEND_DIR, "hooks/useWebSocket.ts"), '''import { useState, useEffect, useCallback, useRef } from "react";
import { WS_BACKEND_URL } from "@/lib/constants";

type WSMessage = {
  type: string;
  audio?: string;
  text?: string;
  [key: string]: any;
};

export function useWebSocket(artifactId: string | null, language: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!artifactId) return;

    const wsUrl = `${WS_BACKEND_URL}/ws/persona/${artifactId}?language=${language}`;
    console.log("Connecting to:", wsUrl);

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
      
      // Auto-reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Reconnecting...");
        connect();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setWs(socket);
  }, [artifactId, language]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(message));
    }
  }, [ws, isConnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (ws) {
      ws.close();
    }
  }, [ws]);

  return { isConnected, messages, sendMessage, disconnect };
}
''')

    # hooks/useAudioRecorder.ts
    create_file(os.path.join(FRONTEND_DIR, "hooks/useAudioRecorder.ts"), '''import { useState, useRef, useCallback } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async (onChunk: (base64: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            onChunk(base64);
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.start(100); // Emit chunks every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, [isRecording]);

  return { start, stop, isRecording };
}
''')

    # hooks/useAudioPlayer.ts
    create_file(os.path.join(FRONTEND_DIR, "hooks/useAudioPlayer.ts"), '''import { useState, useRef, useCallback } from "react";

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const isProcessingRef = useRef(false);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
  };

  const playChunk = useCallback(async (base64Audio: string) => {
    initAudioContext();
    
    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode to AudioBuffer
      const audioBuffer = await audioContextRef.current!.decodeAudioData(bytes.buffer);
      queueRef.current.push(audioBuffer);

      if (!isProcessingRef.current) {
        processQueue();
      }
    } catch (error) {
      console.error("Failed to play audio chunk:", error);
    }
  }, []);

  const processQueue = async () => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsPlaying(false);
      return;
    }

    isProcessingRef.current = true;
    setIsPlaying(true);

    const audioBuffer = queueRef.current.shift()!;
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current!.destination);

    source.onended = () => {
      processQueue();
    };

    source.start();
  };

  const stop = useCallback(() => {
    queueRef.current = [];
    isProcessingRef.current = false;
    setIsPlaying(false);
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return { playChunk, stop, isPlaying };
}
''')

    # ==================== COMPONENTS ====================
    
    # components/LanguageSelector.tsx
    create_file(os.path.join(FRONTEND_DIR, "components/LanguageSelector.tsx"), '''"use client";

import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { LanguageCode } from "@/lib/constants";

type Props = {
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  isAutoDetected: boolean;
};

export default function LanguageSelector({ language, onChangeLanguage, isAutoDetected }: Props) {
  return (
    <div className="relative">
      <select
        value={language}
        onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
        className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      {isAutoDetected && (
        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
          Auto
        </span>
      )}
    </div>
  );
}
''')

    # components/VoiceChat.tsx (simplified version)
    create_file(os.path.join(FRONTEND_DIR, "components/VoiceChat.tsx"), '''"use client";

import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

type Props = {
  artifactId: string;
  language: string;
};

type State = "idle" | "connecting" | "ready" | "listening" | "ai_speaking";

export default function VoiceChat({ artifactId, language }: Props) {
  const [state, setState] = useState<State>("idle");
  const { isConnected, messages, sendMessage } = useWebSocket(artifactId, language);
  const { start: startRecording, stop: stopRecording, isRecording } = useAudioRecorder();
  const { playChunk, stop: stopAudio, isPlaying } = useAudioPlayer();

  useEffect(() => {
    if (state === "idle" || state === "connecting") {
      if (isConnected) {
        setState("ready");
      }
    }
  }, [isConnected, state]);

  useEffect(() => {
    // Process incoming messages
    messages.forEach((msg) => {
      if (msg.type === "audio_chunk" && msg.audio) {
        playChunk(msg.audio);
        if (state !== "ai_speaking") {
          setState("ai_speaking");
        }
      }
      if (msg.type === "turn_complete") {
        setState("ready");
      }
    });
  }, [messages, playChunk, state]);

  const handleStart = () => {
    setState("connecting");
  };

  const handleStartListening = () => {
    setState("listening");
    startRecording((base64) => {
      sendMessage({ type: "audio_chunk", audio: base64 });
    });
  };

  const handleStopListening = () => {
    stopRecording();
    sendMessage({ type: "end_of_turn" });
    setState("ready");
  };

  const handleInterrupt = () => {
    stopAudio();
    sendMessage({ type: "interrupt" });
    setState("listening");
    startRecording((base64) => {
      sendMessage({ type: "audio_chunk", audio: base64 });
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      {state === "idle" && (
        <button
          onClick={handleStart}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-12 py-6 rounded-full shadow-lg transition"
        >
          🎤 Bắt đầu
        </button>
      )}

      {state === "connecting" && (
        <div className="text-white text-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          Đang kết nối...
        </div>
      )}

      {state === "ready" && (
        <div className="text-center">
          <p className="text-gray-300 mb-6">Hãy hỏi về hiện vật này</p>
          <button
            onClick={handleStartListening}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-lg transition"
          >
            🎤 Nhấn để nói
          </button>
        </div>
      )}

      {state === "listening" && (
        <div className="text-center">
          <div className="w-24 h-24 bg-red-500 rounded-full animate-pulse mb-6 mx-auto flex items-center justify-center">
            <span className="text-4xl">🎤</span>
          </div>
          <p className="text-white mb-4">Đang nghe...</p>
          <button
            onClick={handleStopListening}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition"
          >
            ✋ Dừng
          </button>
        </div>
      )}

      {state === "ai_speaking" && (
        <div className="text-center">
          <div className="w-24 h-24 bg-blue-500 rounded-full animate-pulse mb-6 mx-auto flex items-center justify-center">
            <span className="text-4xl">🤖</span>
          </div>
          <p className="text-white mb-4">AI đang trả lời...</p>
          <button
            onClick={handleInterrupt}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition"
          >
            ✋ Ngắt lời
          </button>
        </div>
      )}
    </div>
  );
}
''')

    # ==================== PAGES ====================
    
    # app/page.tsx
    create_file(os.path.join(FRONTEND_DIR, "app/page.tsx"), '''"use client";

import Link from "next/link";
import { useLanguage } from "@/hooks/useLanguage";
import LanguageSelector from "@/components/LanguageSelector";

export default function Home() {
  const { language, changeLanguage, isAutoDetected } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-end p-4">
        <LanguageSelector
          language={language}
          onChangeLanguage={changeLanguage}
          isAutoDetected={isAutoDetected}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <h1 className="text-6xl font-bold text-white mb-4 text-center">
          MuseAI 🎭
        </h1>
        <p className="text-xl text-gray-300 mb-12 text-center max-w-md">
          Hướng dẫn viên AI cho bảo tàng
        </p>

        <div className="space-y-4 w-full max-w-sm">
          <Link
            href="/artifact/statue_tran_hung_dao"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center text-lg px-8 py-4 rounded-xl shadow-lg transition"
          >
            🚀 Demo nhanh
          </Link>

          <button
            className="w-full bg-slate-800 hover:bg-slate-700 text-white text-center text-lg px-8 py-4 rounded-xl shadow-lg transition"
            onClick={() => alert("QR Scanner coming soon!")}
          >
            📷 Quét QR vào bảo tàng
          </button>
        </div>

        <p className="mt-12 text-gray-500 text-sm text-center">
          Gemini Live Agent Challenge 2026
        </p>
      </div>
    </div>
  );
}
''')

    # app/artifact/[id]/page.tsx
    create_file(os.path.join(FRONTEND_DIR, "app/artifact/[id]/page.tsx"), '''"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getArtifact } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import LanguageSelector from "@/components/LanguageSelector";
import VoiceChat from "@/components/VoiceChat";

export default function ArtifactPage() {
  const params = useParams();
  const router = useRouter();
  const artifactId = params.id as string;
  
  const { language, changeLanguage, isAutoDetected } = useLanguage();
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadArtifact() {
      try {
        const data = await getArtifact(artifactId);
        setArtifact(data.data);
      } catch (e) {
        setError("Không tìm thấy hiện vật");
      } finally {
        setLoading(false);
      }
    }
    loadArtifact();
  }, [artifactId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Đang tải...</div>
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-red-400 text-xl mb-4">{error || "Lỗi"}</div>
        <button
          onClick={() => router.push("/")}
          className="bg-slate-700 text-white px-6 py-3 rounded-lg"
        >
          ← Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <button
          onClick={() => router.push("/")}
          className="text-gray-400 hover:text-white transition"
        >
          ← Quay lại
        </button>
        
        <LanguageSelector
          language={language}
          onChangeLanguage={changeLanguage}
          isAutoDetected={isAutoDetected}
        />
      </div>

      {/* Artifact Info */}
      <div className="p-6 bg-slate-800 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-2">
          {artifact.name}
        </h1>
        {artifact.era && (
          <p className="text-gray-400">{artifact.era}</p>
        )}
      </div>

      {/* Voice Chat */}
      <VoiceChat artifactId={artifactId} language={language} />
    </div>
  );
}
''')

    # app/layout.tsx
    create_file(os.path.join(FRONTEND_DIR, "app/layout.tsx"), '''import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MuseAI - Hướng dẫn viên bảo tàng AI",
  description: "AI Agent cho bảo tàng với Gemini Live",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
''')

    # .env.local
    create_file(os.path.join(FRONTEND_DIR, ".env.local"), '''NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
''')

    # public/manifest.json
    create_file(os.path.join(FRONTEND_DIR, "public/manifest.json"), '''{
  "name": "MuseAI - Hướng dẫn viên bảo tàng AI",
  "short_name": "MuseAI",
  "theme_color": "#1A56DB",
  "background_color": "#1E293B",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
''')

    print("\n✅ All files created successfully!")

def main():
    print("=" * 60)
    print("SPRINT 5 - NEXT.JS PWA FRONTEND GENERATOR")
    print("=" * 60)
    
    # Step 1: Setup Next.js
    setup_nextjs()
    
    # Step 2: Create all files
    create_all_files()
    
    print("\n" + "=" * 60)
    print("✅ SPRINT 5 SETUP COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. cd /Users/admin/Desktop/guideQR.ai/museai/frontend")
    print("2. npm run dev")
    print("3. Open http://localhost:3000")
    print("\n")

if __name__ == "__main__":
    main()
