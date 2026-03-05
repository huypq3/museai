"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";
import { LanguageCode } from "@/lib/constants";

const FLAG_MAP: Record<LanguageCode, string> = {
  vi: '🇻🇳',
  en: '🇺🇸',
  fr: '🇫🇷',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
};

const LANG_NAME: Record<LanguageCode, string> = {
  vi: 'VI',
  en: 'EN',
  fr: 'FR',
  ja: 'JP',
  ko: 'KR',
  zh: 'ZH',
};

export default function WelcomePage() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [museum, setMuseum] = useState("demo_museum");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMuseum(params.get("museum") || "demo_museum");
  }, []);

  const handleStart = () => {
    localStorage.setItem('museum_id', museum);
    router.push(`/camera-tour?museum=${museum}`);
  };

  const handleLanguageChange = (newLang: LanguageCode) => {
    changeLanguage(newLang);
    setShowLangMenu(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6"
         style={{
           background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, #0A0A0A 60%)',
         }}>
      
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015]"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
           }} />
      
      {/* Compact Language selector */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowLangMenu(!showLangMenu)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--museum-dim)',
            cursor: 'pointer',
            fontFamily: 'DM Sans',
          }}>
          {FLAG_MAP[language]} {LANG_NAME[language]}
        </button>
        
        {/* Language dropdown */}
        {showLangMenu && (
          <div className="absolute right-0 top-12 rounded-xl overflow-hidden shadow-xl"
               style={{
                 background: 'rgba(20,20,20,0.98)',
                 border: '1px solid rgba(255,255,255,0.1)',
                 minWidth: 120,
               }}>
            {Object.entries(FLAG_MAP).map(([lang, flag]) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang as LanguageCode)}
                className="w-full px-4 py-2 flex items-center gap-3 hover:brightness-125 transition"
                style={{
                  background: language === lang ? 'rgba(201,168,76,0.2)' : 'transparent',
                  fontFamily: 'DM Sans',
                  fontSize: '14px',
                  justifyContent: 'flex-start',
                }}>
                <span className="text-lg">{flag}</span>
                <span style={{ color: 'var(--museum-white)' }}>
                  {LANG_NAME[lang as LanguageCode]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        
        {/* Icon */}
        <div className="text-5xl mb-6 opacity-60">🏛️</div>
        
        {/* Museum name */}
        <p className="text-[var(--gold)] text-xs tracking-[0.2em] uppercase mb-4"
           style={{ fontFamily: 'DM Sans' }}>
          {t(language, 'welcome.museum')}
        </p>
        
        {/* App name */}
        <h1 className="font-display text-[52px] font-light leading-none mb-3"
            style={{ color: 'var(--museum-white)' }}>
          MuseAI
        </h1>
        
        {/* Tagline */}
        <p className="font-display italic text-lg mb-8"
           style={{ color: 'var(--museum-dim)' }}>
          {t(language, 'welcome.tagline')}
        </p>
        
        {/* Divider */}
        <div className="w-10 h-px mb-8"
             style={{ background: 'var(--gold-dim)' }} />
        
        {/* Instructions */}
        <div className="flex flex-col gap-2.5 mb-10 text-sm"
             style={{ color: 'var(--museum-dim)', fontFamily: 'DM Sans' }}>
          <div className="flex items-center gap-3">
            <span className="text-base">📷</span>
            <span>{t(language, 'welcome.hint1')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base">🎤</span>
            <span>{t(language, 'welcome.hint2')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base">✋</span>
            <span>{t(language, 'welcome.hint3')}</span>
          </div>
        </div>
        
        {/* CTA button */}
        <button
          onClick={handleStart}
          className="w-full max-w-[300px] px-8 py-4 rounded-[14px] font-medium text-[15px] transition-all hover:brightness-110"
          style={{
            background: 'var(--gold)',
            color: 'var(--museum-dark)',
            fontFamily: 'DM Sans',
            fontWeight: 500,
          }}>
          {t(language, 'welcome.cta')}
        </button>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-6 text-xs opacity-30"
           style={{ fontFamily: 'DM Sans' }}>
        {t(language, 'welcome.powered')}
      </div>
    </div>
  );
}
