"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRScanner, { QRScanPayload } from "@/components/QRScanner";
import { detectLandingLanguage, LANDING_I18N, type LandingLang } from "@/lib/i18n/landing";
import MuseAILogo from "@/components/MuseAILogo";

const COLORS = {
  bg: "#0A0A0A",
  text: "#F5F0E8",
  muted: "#888888",
  gold: "#C9A84C",
  goldSoft: "#C9A84C33",
} as const;

function QrIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="3" height="3" />
      <rect x="17" y="17" width="3" height="3" />
      <path d="M14 17h3" />
    </svg>
  );
}

export default function LandingPageClient() {
  const router = useRouter();
  const [openScanner, setOpenScanner] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [locale, setLocale] = useState<LandingLang>("en");

  useEffect(() => {
    const detected = detectLandingLanguage();
    setLocale(detected);
    localStorage.setItem("museai_locale", detected);
    localStorage.setItem("lang", detected);
    localStorage.setItem("language", detected);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const messages = useMemo(() => {
    if (locale === "vi") {
      return {
        invalid: "QR code không hợp lệ",
        notMuse: "Không phải QR của hệ thống MuseAI",
        noCamera: "Cần quyền camera. Vui lòng bật camera.",
      };
    }
    return {
      invalid: "Invalid QR code",
      notMuse: "Not a MuseAI QR code",
      noCamera: "Camera access is required.",
    };
  }, [locale]);

  const tr = LANDING_I18N[locale];

  const appendLang = (url: string) => {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("lang", locale);
    return `${u.pathname}${u.search}`;
  };

  const navigateWithLang = (path: string) => router.push(appendLang(path));

  const handleScan = (payload: QRScanPayload) => {
    if (payload.error) {
      setOpenScanner(false);
      const text =
        payload.error === "non_system"
          ? messages.notMuse
          : payload.error === "unreadable"
          ? messages.noCamera
          : messages.invalid;
      setToast(text);
      return;
    }

    const museumId = payload.museum_id;
    const exhibitId = payload.exhibit_id || payload.exhibit_id;

    setOpenScanner(false);

    if (museumId && exhibitId) {
      navigateWithLang(`/welcome?museum=${encodeURIComponent(museumId)}&exhibit=${encodeURIComponent(exhibitId)}`);
      return;
    }

    if (museumId) {
      navigateWithLang(`/welcome?museum=${encodeURIComponent(museumId)}`);
      return;
    }

    if (exhibitId) {
      navigateWithLang(`/exhibit/${encodeURIComponent(exhibitId)}`);
      return;
    }

    setToast(messages.invalid);
  };

  return (
    <main
      style={{
        height: "100dvh",
        overflow: "hidden",
        background: COLORS.bg,
        color: COLORS.text,
      }}
    >
      <div
        style={{
          height: "100%",
          maxWidth: 430,
          margin: "0 auto",
          paddingTop: "max(14px, env(safe-area-inset-top))",
          paddingRight: 20,
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          paddingLeft: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}
      >
        <header
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <MuseAILogo variant="horizontal" theme="dark" iconSize={44} />
        </header>

        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              border: `1px solid ${COLORS.goldSoft}`,
              borderRadius: 999,
              background: "rgba(201,168,76,0.08)",
              color: "rgba(245,240,232,0.72)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {tr.demoBadge}
          </div>
        </div>

        <section style={{ flexShrink: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "Cormorant Garamond, serif",
              fontWeight: 500,
              fontSize: "clamp(36px, 8.4vw, 48px)",
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
            }}
          >
            {tr.heroTitleA}
          </h1>
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: "Cormorant Garamond, serif",
              fontWeight: 500,
              fontStyle: "italic",
              fontSize: "clamp(34px, 8vw, 46px)",
              lineHeight: 1.02,
              color: COLORS.gold,
              letterSpacing: "-0.01em",
            }}
          >
            {tr.heroTitleB}
          </p>
        </section>

        <p
          style={{
            margin: 0,
            flexShrink: 0,
            color: "rgba(245,240,232,0.72)",
            fontFamily: "DM Sans, sans-serif",
            fontSize: 14,
            lineHeight: 1.35,
          }}
        >
          {tr.demoSubtitle}
        </p>

        <section
          aria-label={tr.demoVideoAriaLabel}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 220,
            borderRadius: 12,
            border: `1px solid ${COLORS.goldSoft}`,
            overflow: "hidden",
            background: "linear-gradient(135deg, #151515, #1f1f1f)",
          }}
        >
          <img
            src="/museai_demo.jpg"
            alt={tr.demoVideoAriaLabel}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "32%",
              background: "linear-gradient(to top, rgba(10,10,10,0.38), rgba(10,10,10,0))",
              pointerEvents: "none",
            }}
          />
        </section>

        <section
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingBottom: "max(2px, env(safe-area-inset-bottom))",
          }}
        >
          <button
            onClick={() => setOpenScanner(true)}
            style={{
              width: "100%",
              height: 56,
              border: "none",
              borderRadius: 8,
              background: COLORS.gold,
              color: COLORS.bg,
              fontFamily: "DM Sans, sans-serif",
              fontSize: 16,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: "pointer",
            }}
            aria-label="Scan QR to begin"
          >
            <QrIcon />
            <span>{tr.demoCtaPrimary}</span>
          </button>

          <p
            style={{
              margin: 0,
              textAlign: "center",
              color: COLORS.muted,
              fontFamily: "DM Sans, sans-serif",
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            {tr.demoCtaReassurance}
          </p>
        </section>
      </div>

      {openScanner && <QRScanner onScan={handleScan} onClose={() => setOpenScanner(false)} language={locale} />}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "max(20px, env(safe-area-inset-bottom))",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.86)",
            border: `1px solid ${COLORS.goldSoft}`,
            color: COLORS.text,
            borderRadius: 8,
            padding: "9px 12px",
            fontFamily: "DM Sans, sans-serif",
            fontSize: 12,
            zIndex: 60,
            maxWidth: "calc(100vw - 32px)",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}

      <style jsx>{`
        @keyframes goldPulse {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
        }
      `}</style>
    </main>
  );
}
