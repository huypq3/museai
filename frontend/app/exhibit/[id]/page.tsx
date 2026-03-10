"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExhibit, validateExhibitMuseum, validateExhibitSession, validateMuseum } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";
import VoiceChat from "@/components/VoiceChat";
import { trackEvent } from "@/lib/analytics";
import { LanguageCode } from "@/lib/constants";

export default function ExhibitPage() {
  const params = useParams();
  const router = useRouter();
  const exhibitIdRaw = params?.id;
  const exhibitId = Array.isArray(exhibitIdRaw) ? exhibitIdRaw[0] : exhibitIdRaw;

  const { language, changeLanguage } = useLanguage();
  const [exhibit, setExhibit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [museumId, setMuseumId] = useState<string>("demo_museum");
  const [museumName, setMuseumName] = useState<string>("demo_museum");
  const [museumData, setMuseumData] = useState<{ id: string; name?: string; name_en?: string } | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkToken() {
      const query = new URLSearchParams(window.location.search);
      const token = query.get("token");
      if (!exhibitId || !token) {
        if (mounted) setTokenValid(false);
        return;
      }
      try {
        const session = await validateExhibitSession(token, exhibitId);
        if (!mounted) return;
        localStorage.setItem("museum_id", session.museum_id);
        setTokenValid(true);
      } catch {
        if (!mounted) return;
        setTokenValid(false);
      }
    }

    checkToken();
    return () => {
      mounted = false;
    };
  }, [exhibitId]);

  useEffect(() => {
    if (tokenValid === false) {
      router.replace("/?error=session_expired");
    }
  }, [tokenValid, router]);

  useEffect(() => {
    let mounted = true;

    async function loadExhibit() {
      if (tokenValid !== true) return;
      if (!exhibitId) {
        setError("Exhibit not found");
        setLoading(false);
        return;
      }
      try {
        const query = new URLSearchParams(window.location.search);
        const museumQuery = query.get("museum");
        const museumFromLocal = localStorage.getItem("museum_id");
        const resolvedMuseumId = museumQuery || museumFromLocal;

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
        setMuseumData({ id: museum.id, name: museum.name, name_en: museum.name_en });
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
  }, [exhibitId, router, tokenValid]);

  useEffect(() => {
    if (!museumData) return;
    setMuseumName(
      language === "en"
        ? museumData.name_en || museumData.name || museumData.id
        : museumData.name || museumData.name_en || museumData.id
    );
  }, [language, museumData]);

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (tokenValid === false) {
    return null;
  }
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
        exhibitId={exhibitId || ""}
        language={language}
        onLanguageChange={(next) => {
          const nextLang = next as LanguageCode;
          if (!nextLang || nextLang === language) return;
          try {
            trackEvent("language_changed", museumId, exhibitId || undefined, { from: language, to: nextLang });
          } catch {
            // best effort analytics
          }
          changeLanguage(nextLang);
        }}
        museumName={museumName || exhibit.museum_id || museumId}
      />
    </div>
  );
}
