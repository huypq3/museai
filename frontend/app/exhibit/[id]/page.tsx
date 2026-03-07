"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExhibit, validateExhibitMuseum, validateMuseum } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";
import VoiceChat from "@/components/VoiceChat";
import { trackEvent } from "@/lib/analytics";

export default function ExhibitPage() {
  const params = useParams();
  const router = useRouter();
  const exhibitId = params.id as string;

  const { language, changeLanguage } = useLanguage();
  const [exhibit, setExhibit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [museumId, setMuseumId] = useState<string>("demo_museum");
  const [museumName, setMuseumName] = useState<string>("demo_museum");

  useEffect(() => {
    let mounted = true;

    async function loadExhibit() {
      try {
        const params = new URLSearchParams(window.location.search);
        const museumFromQuery = params.get("museum");
        const museumFromLocal = localStorage.getItem("museum_id");
        const resolvedMuseumId = museumFromQuery || museumFromLocal;

        if (!resolvedMuseumId) {
          router.replace("/error?code=MUSEUM_REQUIRED");
          return;
        }

        const museum = await validateMuseum(resolvedMuseumId);
        await validateExhibitMuseum(exhibitId, museum.id);
        const data = await getExhibit(exhibitId);

        if (!mounted) return;

        localStorage.setItem("museum_id", museum.id);
        setMuseumId(museum.id);
        setMuseumName(language === "en" ? (museum.name_en || museum.name || museum.id) : (museum.name || museum.name_en || museum.id));
        setExhibit(data.data);
        trackEvent("qr_scan", museum.id, exhibitId);
        trackEvent("conversation_start", museum.id, exhibitId);
      } catch (e: unknown) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : String(e || "");
        if (msg.includes("Museum validation failed")) {
          router.replace("/error?code=MUSEUM_NOT_FOUND");
          return;
        }
        setError("Exhibit not found");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadExhibit();
    return () => {
      mounted = false;
    };
  }, [exhibitId, language, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !exhibit) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-red-400 text-xl mb-4 font-display">{error || "Error"}</div>
        <button
          onClick={() => router.push(`/camera-tour?museum=${encodeURIComponent(museumId)}`)}
          className="px-6 py-3 rounded-[14px]"
          style={{
            background: "var(--gold)",
            color: "var(--museum-dark)",
            fontFamily: "DM Sans",
          }}
        >
          ← {t(language, "error.back")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <VoiceChat
        artifactId={exhibitId}
        language={language}
        onLanguageChange={(next) => {
          trackEvent("language_changed", museumId, exhibitId, { from: language, to: next });
          changeLanguage(next);
        }}
        museumName={museumName || exhibit.museum_id || museumId}
      />
    </div>
  );
}
