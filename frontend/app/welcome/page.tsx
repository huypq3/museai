"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";
import { LanguageCode } from "@/lib/constants";
import { MuseumValidation, validateMuseum } from "@/lib/api";

const FLAG_MAP: Record<LanguageCode, string> = {
  vi: "🇻🇳",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
};

const LANG_NAME: Record<LanguageCode, string> = {
  vi: "VI",
  en: "EN",
  es: "ES",
  fr: "FR",
  ja: "JP",
  ko: "KR",
  zh: "ZH",
};

function MuseumSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="w-12 h-12 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mb-6" />
      <p style={{ color: "#F5F0E8", fontFamily: "DM Sans", opacity: 0.8 }}>Loading museum...</p>
    </div>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [museum, setMuseum] = useState<MuseumValidation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initMuseum() {
      const params = new URLSearchParams(window.location.search);
      const museumFromQr = params.get("museum");
      const exhibitFromQr = params.get("exhibit") || params.get("artifact");

      if (!museumFromQr) {
        router.replace("/error?code=MUSEUM_REQUIRED");
        return;
      }

      try {
        const museumData = await validateMuseum(museumFromQr);
        if (!mounted) return;

        setMuseum(museumData);
        localStorage.setItem("museum_id", museumData.id);

        if (exhibitFromQr) {
          router.replace(`/exhibit/${encodeURIComponent(exhibitFromQr)}?museum=${encodeURIComponent(museumData.id)}`);
          return;
        }
      } catch {
        if (!mounted) return;
        router.replace("/error?code=MUSEUM_NOT_FOUND");
        return;
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initMuseum();
    return () => {
      mounted = false;
    };
  }, [router]);

  const museumDisplayName = useMemo(() => {
    if (!museum) return t(language, "welcome.museum");
    if (language === "en") return museum.name_en || museum.name || museum.id;
    return museum.name || museum.name_en || museum.id;
  }, [museum, language]);

  const welcomeMessage = useMemo(() => {
    if (!museum?.welcome_message) return t(language, "welcome.tagline");
    return museum.welcome_message[language] || museum.welcome_message.vi || museum.welcome_message.en || t(language, "welcome.tagline");
  }, [museum, language]);
  const goldColor = museum?.theme?.gold_accent || "#C9A84C";

  const handleStart = () => {
    if (!museum?.id) {
      router.replace("/error?code=MUSEUM_REQUIRED");
      return;
    }
    localStorage.setItem("museum_id", museum.id);
    router.push(`/camera-tour?museum=${encodeURIComponent(museum.id)}`);
  };

  const handleLanguageChange = (newLang: LanguageCode) => {
    changeLanguage(newLang);
    setShowLangMenu(false);
  };

  if (loading) return <MuseumSkeleton />;
  if (!museum) return null;

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center px-6"
      style={{
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        background: "radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, #0A0A0A 60%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowLangMenu(!showLangMenu)}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--museum-dim)",
            cursor: "pointer",
            fontFamily: "DM Sans",
          }}
        >
          {FLAG_MAP[language]} {LANG_NAME[language]}
        </button>

        {showLangMenu && (
          <div
            className="absolute right-0 top-12 rounded-xl overflow-hidden shadow-xl"
            style={{
              background: "rgba(20,20,20,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              minWidth: 120,
            }}
          >
            {Object.entries(FLAG_MAP).map(([lang, flag]) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang as LanguageCode)}
                className="w-full px-4 py-2 flex items-center gap-3 hover:brightness-125 transition"
                style={{
                  background: language === lang ? "rgba(201,168,76,0.2)" : "transparent",
                  fontFamily: "DM Sans",
                  fontSize: "14px",
                  justifyContent: "flex-start",
                }}
              >
                <span className="text-lg">{flag}</span>
                <span style={{ color: "var(--museum-white)" }}>{LANG_NAME[lang as LanguageCode]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {museum.logo_url ? (
          <img
            src={museum.logo_url}
            alt={museumDisplayName}
            style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 20, borderRadius: 12 }}
          />
        ) : (
          <div className="text-5xl mb-6 opacity-60">🏛️</div>
        )}

        <p className="text-xs tracking-[0.2em] uppercase mb-4" style={{ fontFamily: "DM Sans", color: goldColor }}>
          {museumDisplayName}
        </p>

        <h1 className="font-display text-[52px] font-light leading-none mb-3" style={{ color: "var(--museum-white)" }}>
          MuseAI
        </h1>

        <p className="font-display italic text-lg mb-8" style={{ color: "var(--museum-dim)" }}>
          {welcomeMessage}
        </p>

        <div className="w-10 h-px mb-8" style={{ background: "rgba(201,168,76,0.35)" }} />

        <div className="flex flex-col gap-2.5 mb-10 text-sm" style={{ color: "var(--museum-dim)", fontFamily: "DM Sans" }}>
          <div className="flex items-center gap-3">
            <span className="text-base">📷</span>
            <span>{t(language, "welcome.hint1")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base">🎤</span>
            <span>{t(language, "welcome.hint2")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base">✋</span>
            <span>{t(language, "welcome.hint3")}</span>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full max-w-[300px] px-8 py-4 rounded-[14px] font-medium text-[15px] transition-all hover:brightness-110"
          style={{
            background: goldColor,
            color: "var(--museum-dark)",
            fontFamily: "DM Sans",
            fontWeight: 500,
            marginBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          {t(language, "welcome.cta")}
        </button>
      </div>

      <div className="absolute text-xs opacity-30" style={{ fontFamily: "DM Sans", bottom: "max(24px, env(safe-area-inset-bottom))" }}>
        {t(language, "welcome.powered")}
      </div>
    </div>
  );
}
