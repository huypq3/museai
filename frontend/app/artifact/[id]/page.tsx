"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getArtifact } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import VoiceChat from "@/components/VoiceChat";

const LANGUAGE_FLAGS: Record<string, string> = {
  vi: "🇻🇳",
  en: "🇬🇧",
  fr: "🇫🇷",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
};

export default function ArtifactPage() {
  const params = useParams();
  const router = useRouter();
  const artifactId = params.id as string;
  
  const { language, changeLanguage } = useLanguage();
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const museumId = typeof window !== 'undefined' 
    ? localStorage.getItem('museum_id') || 'demo_museum'
    : 'demo_museum';

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

  const handleLanguageChange = (newLang: string) => {
    changeLanguage(newLang);
    setShowLangMenu(false);
  };

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
    <div className="min-h-screen flex flex-col">
      {/* Voice Chat - full screen with its own header */}
      <VoiceChat 
        artifactId={artifactId} 
        language={language}
        onLanguageChange={changeLanguage}
        museumName={artifact.museum_id || museumId}
      />
    </div>
  );
}
