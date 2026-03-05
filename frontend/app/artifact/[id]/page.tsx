"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getArtifact } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import VoiceChat from "@/components/VoiceChat";
import { trackEvent } from "@/lib/analytics";

export default function ArtifactPage() {
  const params = useParams();
  const router = useRouter();
  const artifactId = params.id as string;
  
  const { language, changeLanguage } = useLanguage();
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const museumId = typeof window !== 'undefined' 
    ? localStorage.getItem('museum_id') || 'demo_museum'
    : 'demo_museum';

  useEffect(() => {
    async function loadArtifact() {
      try {
        const data = await getArtifact(artifactId);
        setArtifact(data.data);
        trackEvent("qr_scan", data.data?.museum_id || museumId, artifactId);
        trackEvent("conversation_start", data.data?.museum_id || museumId, artifactId);
      } catch {
        setError("Không tìm thấy hiện vật");
      } finally {
        setLoading(false);
      }
    }
    loadArtifact();
  }, [artifactId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-red-400 text-xl mb-4 font-display">{error || "Lỗi"}</div>
        <button
          onClick={() => router.push(`/camera-tour?museum=${museumId}`)}
          className="px-6 py-3 rounded-[14px]"
          style={{
            background: 'var(--gold)',
            color: 'var(--museum-dark)',
            fontFamily: 'DM Sans',
          }}>
          ← Quay lại camera
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Voice Chat - full screen with its own header */}
      <VoiceChat 
        artifactId={artifactId} 
        language={language}
        onLanguageChange={(next) => {
          trackEvent("language_changed", museumId, artifactId, { from: language, to: next });
          changeLanguage(next);
        }}
        museumName={artifact.museum_id || museumId}
      />
    </div>
  );
}
