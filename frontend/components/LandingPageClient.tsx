"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRScanner, { QRScanPayload } from "@/components/QRScanner";
import {
  detectLandingLanguage,
  LANDING_FAQ_KEYS,
  LANDING_I18N,
  LANGUAGE_LABELS,
  LandingLang,
  SUPPORTED_LANDING_LANGS,
} from "@/lib/i18n/landing";

const BRAND = {
  bg: "#0A0A0A",
  surface: "#111111",
  card: "#161616",
  gold: "#C9A84C",
  goldMuted: "rgba(201,168,76,0.12)",
  goldBorder: "rgba(201,168,76,0.2)",
  text: "#F5F0E8",
  textSecondary: "rgba(245,240,232,0.6)",
  textMuted: "rgba(245,240,232,0.3)",
};

type CountUpResult = {
  count: number;
  ref: RefObject<HTMLDivElement>;
};

function useCountUp(end: number, duration = 2000): CountUpResult {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;

        let value = 0;
        const step = end / (duration / 16);
        const timer = window.setInterval(() => {
          value += step;
          if (value >= end) {
            setCount(end);
            window.clearInterval(timer);
          } else {
            setCount(Math.floor(value));
          }
        }, 16);
      },
      { threshold: 0.5 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [duration, end]);

  return { count, ref };
}

type CountStatProps = {
  label: string;
  end: number;
  suffix?: string;
};

function CountStat({ label, end, suffix = "" }: CountStatProps) {
  const { count, ref } = useCountUp(end);
  return (
    <div ref={ref} className="text-center lg:text-left">
      <div style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 52, lineHeight: 1 }}>
        {count}
        {suffix}
      </div>
      <div style={{ color: BRAND.textSecondary, marginTop: 6, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState<LandingLang>("en");
  const [openScanner, setOpenScanner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tr = LANDING_I18N[language];

  useEffect(() => {
    const detected = detectLandingLanguage();
    setLanguage(detected);
    localStorage.setItem("lang", detected);
    localStorage.setItem("language", detected);
  }, []);

  useEffect(() => {
    localStorage.setItem("lang", language);
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!langDropdownOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(ev.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [langDropdownOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const faqItems = useMemo(
    () => LANDING_FAQ_KEYS.map(({ q, a }) => ({ q: tr[q], a: tr[a] })),
    [tr]
  );

  const appendLang = (url: string) => {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("lang", language);
    return `${u.pathname}${u.search}`;
  };

  const navigateWithLang = (path: string) => router.push(appendLang(path));

  const handleScan = (payload: QRScanPayload) => {
    if (payload.error) {
      setOpenScanner(false);
      const text =
        payload.error === "non_system"
          ? tr.toastNotMuse
          : payload.error === "unreadable"
          ? tr.toastNoCamera
          : tr.toastInvalid;
      setToast({ type: "error", text });
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

    setToast({ type: "error", text: tr.toastInvalid });
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main
      style={{
        background: BRAND.bg,
        color: BRAND.text,
        fontFamily: "DM Sans, system-ui, sans-serif",
        scrollBehavior: "smooth",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'140\' height=\'140\' viewBox=\'0 0 140 140\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.86\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'140\' height=\'140\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E')",
          zIndex: 1,
          opacity: 0.9,
        }}
      />

      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 72,
          zIndex: 50,
          borderBottom: isScrolled ? `1px solid ${BRAND.goldBorder}` : "1px solid transparent",
          background: isScrolled ? "rgba(10,10,10,0.88)" : "rgba(10,10,10,0.28)",
          backdropFilter: isScrolled ? "blur(12px)" : "blur(4px)",
          transition: "all 0.7s ease",
        }}
      >
        <div className="mx-auto w-full max-w-[1200px] h-full px-5 lg:px-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 24 }}>MuseAI</span>
            <span style={{ width: 1, height: 24, background: "rgba(201,168,76,0.3)" }} />
            <span
              style={{
                color: BRAND.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              by GuideQR.ai
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-7">
            <button onClick={() => scrollTo("visitors")} className="landing-link">{tr.navVisitors}</button>
            <button onClick={() => scrollTo("for-museums")} className="landing-link">{tr.navMuseums}</button>
            <button onClick={() => scrollTo("features")} className="landing-link">{tr.navFeatures}</button>
            <button onClick={() => scrollTo("how-it-works")} className="landing-link">{tr.navHow}</button>
          </nav>

          <div className="hidden md:flex items-center gap-3" ref={dropdownRef}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setLangDropdownOpen((v) => !v)}
                className="landing-btn-outline"
                style={{ minWidth: 104, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
              >
                <span>{`${LANGUAGE_LABELS[language].flag} ${LANGUAGE_LABELS[language].code}`}</span>
                <span style={{ color: BRAND.textMuted }}>▾</span>
              </button>
              {langDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 220,
                    borderRadius: 8,
                    border: `1px solid ${BRAND.goldBorder}`,
                    background: BRAND.card,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
                    overflow: "hidden",
                  }}
                >
                  {SUPPORTED_LANDING_LANGS.map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setLanguage(code);
                        setLangDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        color: code === language ? BRAND.gold : BRAND.text,
                        background: code === language ? "rgba(201,168,76,0.12)" : "transparent",
                        textAlign: "left",
                      }}
                    >
                      <span>{LANGUAGE_LABELS[code].flag}</span>
                      <span>{LANGUAGE_LABELS[code].name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span style={{ width: 1, height: 22, background: "rgba(201,168,76,0.3)" }} />
            <Link href="/admin/login" className="landing-link">{tr.navAdmin}</Link>
            <button onClick={() => setOpenScanner(true)} className="landing-btn-outline">{tr.navScan}</button>
          </div>

          <button
            className="md:hidden landing-btn-outline"
            style={{ padding: "8px 10px" }}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            className="md:hidden"
            style={{
              borderTop: `1px solid ${BRAND.goldBorder}`,
              background: "rgba(10,10,10,0.98)",
              padding: "12px 20px 18px",
            }}
          >
            <div className="flex flex-col gap-3">
              <button className="landing-link text-left" onClick={() => scrollTo("visitors")}>{tr.navVisitors}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("for-museums")}>{tr.navMuseums}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("features")}>{tr.navFeatures}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("how-it-works")}>{tr.navHow}</button>
              <div style={{ position: "relative", marginTop: 8 }}>
                <button
                  onClick={() => setLangDropdownOpen((v) => !v)}
                  className="landing-btn-outline"
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span>{`${LANGUAGE_LABELS[language].flag} ${LANGUAGE_LABELS[language].code}`}</span>
                  <span style={{ color: BRAND.textMuted }}>▾</span>
                </button>
                {langDropdownOpen && (
                  <div
                    style={{
                      marginTop: 8,
                      borderRadius: 8,
                      border: `1px solid ${BRAND.goldBorder}`,
                      background: BRAND.card,
                      overflow: "hidden",
                    }}
                  >
                    {SUPPORTED_LANDING_LANGS.map((code) => (
                      <button
                        key={code}
                        onClick={() => {
                          setLanguage(code);
                          setLangDropdownOpen(false);
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          display: "flex",
                          gap: 10,
                          color: code === language ? BRAND.gold : BRAND.text,
                          background: code === language ? "rgba(201,168,76,0.12)" : "transparent",
                        }}
                      >
                        <span>{LANGUAGE_LABELS[code].flag}</span>
                        <span>{LANGUAGE_LABELS[code].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setOpenScanner(true)} className="landing-btn-outline">{tr.navScan}</button>
            </div>
          </div>
        )}
      </header>

      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          paddingTop: 112,
          paddingBottom: 120,
          zIndex: 2,
          background:
            "radial-gradient(80% 65% at 8% 8%, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.03) 35%, rgba(10,10,10,0) 72%), #0A0A0A",
        }}
      >
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="landing-eyebrow" style={{ marginBottom: 18 }}>{tr.powered}</div>
            <h1
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontWeight: 500,
                lineHeight: 0.95,
                fontSize: "clamp(54px, 8vw, 80px)",
                maxWidth: 740,
              }}
            >
              {tr.heroTitleA}
              <br />
              <span style={{ color: BRAND.gold, fontStyle: "italic" }}>{tr.heroTitleB}</span>
            </h1>
            <p style={{ marginTop: 24, maxWidth: 600, color: BRAND.textSecondary, fontSize: 18, lineHeight: 1.7 }}>
              {tr.heroSubtitle}
            </p>
            <div style={{ marginTop: 30, width: 80, height: 1, background: "rgba(201,168,76,0.5)" }} />
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <button className="landing-btn-primary" onClick={() => setOpenScanner(true)}>
                {tr.heroPrimary}
              </button>
              <button className="landing-link" onClick={() => scrollTo("for-museums")}>{tr.heroSecondary}</button>
            </div>
            <p style={{ marginTop: 12, color: BRAND.textMuted, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>{tr.heroCaption}</p>
          </div>

          <div className="hidden md:flex justify-center lg:justify-end">
            <div
              style={{
                width: 280,
                height: 560,
                background: "#0D0D0D",
                border: "1.5px solid rgba(255,255,255,0.12)",
                borderRadius: 40,
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
                padding: "14px 14px 18px",
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 28,
                  background: "#0D0D0D",
                  borderRadius: "0 0 16px 16px",
                  margin: "-14px auto 10px",
                  position: "relative",
                  zIndex: 2,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />

              <div style={{ color: BRAND.textSecondary, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tr.phoneMuseum}</div>

              <div
                style={{
                  marginTop: 10,
                  border: "1px solid rgba(201,168,76,0.3)",
                  borderRadius: 14,
                  height: 210,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=700&q=80"
                  alt="Museum exhibit preview"
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.72 }}
                />
                <div className="phone-corner tl" />
                <div className="phone-corner tr" />
                <div className="phone-corner bl" />
                <div className="phone-corner br" />
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${BRAND.goldBorder}`,
                  background: "rgba(201,168,76,0.08)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: BRAND.gold }}>✓</span>
                <span>{tr.phoneExhibit}</span>
              </div>

              <div style={{ marginTop: 14, color: BRAND.gold, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>{tr.phoneStatus}</div>
              <div className="waveform" aria-hidden>
                {Array.from({ length: 7 }).map((_, idx) => (
                  <span key={idx} className="bar" style={{ animationDelay: `${idx * 0.1}s` }} />
                ))}
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: BRAND.text,
                  opacity: 0.7,
                  lineHeight: 1.5,
                  borderTop: "1px solid rgba(201,168,76,0.12)",
                  paddingTop: 10,
                }}
              >
                “{tr.phoneTranscript}”
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ zIndex: 2, position: "relative", background: BRAND.surface, borderTop: `1px solid ${BRAND.goldBorder}`, borderBottom: `1px solid ${BRAND.goldBorder}` }}>
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12 py-10 grid grid-cols-3 gap-8">
          <CountStat label={tr.statLangLabel} end={10} suffix="+" />
          <CountStat label={tr.statAppsLabel} end={0} />
          <div className="text-center lg:text-left">
            <div style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 52, lineHeight: 1 }}>&lt;2s</div>
            <div style={{ color: BRAND.textSecondary, marginTop: 6, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tr.statLatencyLabel}</div>
          </div>
        </div>
      </section>

      <section id="visitors" className="landing-section" style={{ zIndex: 2, position: "relative" }}>
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <div className="landing-label">{tr.visitorsEyebrow}</div>
            <h2 className="landing-title" style={{ marginTop: 16 }}>{tr.visitorsTitle}</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              {[
                { title: tr.vp1Title, desc: tr.vp1Desc },
                { title: tr.vp2Title, desc: tr.vp2Desc },
                { title: tr.vp3Title, desc: tr.vp3Desc },
              ].map((item) => (
                <div key={item.title} className="landing-card">
                  <div style={{ color: BRAND.gold }}>✦</div>
                  <div style={{ fontWeight: 500, marginTop: 8 }}>{item.title}</div>
                  <p style={{ color: BRAND.textSecondary, marginTop: 8, lineHeight: 1.7 }}>{item.desc}</p>
                </div>
              ))}
            </div>
            <button className="landing-btn-outline mt-8" onClick={() => setOpenScanner(true)}>{tr.visitorsCta}</button>
          </div>
          <img
            src="https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=700&q=80"
            alt="Visitor using phone in museum"
            loading="lazy"
            style={{ width: "100%", borderRadius: 8, border: `1px solid ${BRAND.goldBorder}` }}
          />
        </div>
      </section>

      <section id="how-it-works" className="landing-section" style={{ paddingTop: 0, zIndex: 2, position: "relative" }}>
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12">
          <div className="landing-label">{tr.howEyebrow}</div>
          <h2 className="landing-title" style={{ marginTop: 14 }}>{tr.howTitle}</h2>
          <div className="how-grid mt-10">
            <div className="how-dashed" />
            {[
              { n: "01", t: tr.how1Title, d: tr.how1Desc },
              { n: "02", t: tr.how2Title, d: tr.how2Desc },
              { n: "03", t: tr.how3Title, d: tr.how3Desc },
            ].map((step) => (
              <article key={step.n} className="landing-card how-card" style={{ position: "relative", overflow: "hidden", minHeight: 220 }}>
                <span className="how-num">{step.n}</span>
                <h3 className="how-title">{step.t}</h3>
                <p className="how-desc">{step.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="landing-section" style={{ paddingTop: 0, zIndex: 2, position: "relative" }}>
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12">
          <div className="landing-label">{tr.featuresEyebrow}</div>
          <h2 className="landing-title" style={{ marginTop: 14 }}>{tr.featuresTitle}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {[
              { icon: "🎙️", title: tr.f1Title, desc: tr.f1Desc },
              { icon: "📷", title: tr.f2Title, desc: tr.f2Desc },
              { icon: "🧭", title: tr.f3Title, desc: tr.f3Desc },
              { icon: "🌐", title: tr.f4Title, desc: tr.f4Desc },
              { icon: "⚡", title: tr.f5Title, desc: tr.f5Desc },
              { icon: "📊", title: tr.f6Title, desc: tr.f6Desc },
            ].map((item) => (
              <article key={item.title} className="landing-card landing-feature-card">
                <div style={{ fontSize: 26 }}>{item.icon}</div>
                <h3 style={{ marginTop: 10, fontFamily: "Cormorant Garamond, serif", fontSize: 30 }}>{item.title}</h3>
                <p style={{ marginTop: 8, color: BRAND.textSecondary, lineHeight: 1.7 }}>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="for-museums" className="landing-section" style={{ zIndex: 2, position: "relative", background: BRAND.surface, borderTop: `1px solid ${BRAND.goldBorder}` }}>
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12">
          <div className="landing-label">{tr.museumsEyebrow}</div>
          <h2 className="landing-title" style={{ marginTop: 14, maxWidth: 820 }}>{tr.museumsTitle}</h2>

          <div className="grid lg:grid-cols-[1fr_1fr] gap-8 mt-10 items-start">
            <div className="landing-card" style={{ background: BRAND.card }}>
              <ul className="space-y-3">
                {[tr.m1, tr.m2, tr.m3, tr.m4, tr.m5, tr.m6, tr.m7].map((it) => (
                  <li key={it} style={{ display: "flex", gap: 10, color: BRAND.textSecondary }}>
                    <span style={{ color: BRAND.gold }}>✦</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="landing-card"
              style={{
                border: `1px solid ${BRAND.goldBorder}`,
                borderRadius: 8,
                padding: 24,
                background: "radial-gradient(55% 100% at 0% 0%, rgba(201,168,76,0.11), rgba(22,22,22,0.92) 70%)",
                boxShadow: "0 0 60px rgba(201,168,76,0.08)",
              }}
            >
              <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 38, color: BRAND.gold }}>{tr.earlyTitle}</h3>
              <p style={{ color: BRAND.textSecondary, marginTop: 8 }}>{tr.earlySubtitle}</p>
              <div className="mt-5 grid gap-3">
                <input className="landing-input" placeholder={tr.museumInput} />
                <input className="landing-input" placeholder={tr.emailInput} />
                <button className="landing-btn-primary" onClick={() => router.push("/admin/login")}>{tr.earlyBtn}</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 100, zIndex: 2, position: "relative" }}>
        <div className="mx-auto w-full max-w-[1200px] px-5 lg:px-12">
          <h2 className="landing-title" style={{ textAlign: "center" }}>{tr.faqTitle}</h2>
          <div className="mt-8 space-y-3 max-w-[900px] mx-auto">
            {faqItems.map((item, idx) => {
              const open = openIndex === idx;
              return (
                <article key={item.q} className="landing-card" style={{ padding: 0, overflow: "hidden" }}>
                  <button
                    onClick={() => setOpenIndex(open ? null : idx)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "16px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: BRAND.text,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.q}</span>
                    <span style={{ color: BRAND.gold }}>{open ? "−" : "+"}</span>
                  </button>
                  {open && <p style={{ padding: "0 18px 18px", color: BRAND.textSecondary, lineHeight: 1.7 }}>{item.a}</p>}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="landing-section"
        style={{
          paddingTop: 140,
          paddingBottom: 150,
          zIndex: 2,
          position: "relative",
          background: "radial-gradient(55% 80% at 50% 40%, rgba(201,168,76,0.18), rgba(10,10,10,0.92) 70%)",
        }}
      >
        <div className="mx-auto max-w-[900px] px-5 lg:px-12 text-center">
          <h2 className="landing-title">{tr.finalTitle}</h2>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="landing-btn-primary" onClick={() => router.push("/admin/login")}>{tr.finalPrimary}</button>
            <a href="https://github.com/huypq3/museai/" target="_blank" rel="noreferrer" className="landing-link">{tr.finalSecondary} ↗</a>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${BRAND.goldBorder}`, position: "relative", zIndex: 2 }}>
        <div className="footer-grid mx-auto w-full max-w-[1200px] px-5 lg:px-12 py-10">
          <div>
            <div style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 28 }}>MuseAI</div>
            <div style={{ color: BRAND.textMuted, marginTop: 8, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Point. Scan. Discover.</div>
            <div style={{ marginTop: 12, color: BRAND.textSecondary, fontSize: 13 }}>{tr.footerCopy}</div>
          </div>
          <div>
            <div className="landing-footer-heading">{tr.footerProduct}</div>
            <div className="footer-links">
              <button className="landing-link text-left" onClick={() => scrollTo("features")}>{tr.navFeatures}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("how-it-works")}>{tr.navHow}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("for-museums")}>{tr.navMuseums}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("visitors")}>{tr.navVisitors}</button>
            </div>
          </div>
          <div>
            <div className="landing-footer-heading">{tr.footerResources}</div>
            <div className="footer-links">
              <Link className="landing-link" href="/admin/login">{tr.navAdmin}</Link>
              <a className="landing-link" href="https://github.com/huypq3/museai/" target="_blank" rel="noreferrer">GitHub Repo</a>
              <a className="landing-link" href="mailto:hello@guideqr.ai">hello@guideqr.ai</a>
            </div>
          </div>
        </div>
      </footer>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "max(20px, env(safe-area-inset-bottom))",
            transform: "translateX(-50%)",
            zIndex: 100,
            padding: "12px 16px",
            borderRadius: 8,
            border: `1px solid ${toast.type === "error" ? "#ef4444" : BRAND.gold}`,
            background: toast.type === "error" ? "rgba(127, 29, 29, 0.92)" : "rgba(24, 24, 24, 0.92)",
            color: BRAND.text,
          }}
        >
          {toast.text}
        </div>
      )}

      {openScanner && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.92)" }}>
          <QRScanner onScan={handleScan} onClose={() => setOpenScanner(false)} language={language} />
          <p
            style={{
              position: "fixed",
              bottom: "max(18px, env(safe-area-inset-bottom))",
              width: "100%",
              textAlign: "center",
              zIndex: 95,
              color: BRAND.gold,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {tr.scanHint}
          </p>
        </div>
      )}

      <style jsx global>{`
        .landing-section {
          padding-top: 120px;
          padding-bottom: 120px;
        }
        .landing-title {
          font-family: Cormorant Garamond, serif;
          font-size: clamp(38px, 5vw, 58px);
          line-height: 1.06;
          font-weight: 500;
        }
        .landing-label {
          font-family: DM Sans, sans-serif;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: ${BRAND.gold};
          font-weight: 500;
          margin-bottom: 16px;
        }
        .landing-eyebrow {
          display: inline-flex;
          align-items: center;
          border: 1px solid ${BRAND.goldBorder};
          padding: 6px 12px;
          border-radius: 6px;
          color: ${BRAND.gold};
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .landing-card {
          background: ${BRAND.card};
          border: 1px solid rgba(201, 168, 76, 0.15);
          border-radius: 8px;
          padding: 18px;
          transition: transform 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease;
        }
        .landing-feature-card:hover {
          transform: translateY(-4px);
          border-color: rgba(201, 168, 76, 0.4);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        }
        .landing-btn-primary {
          border: 1px solid ${BRAND.gold};
          background: ${BRAND.gold};
          color: ${BRAND.bg};
          border-radius: 6px;
          padding: 12px 18px;
          font-weight: 500;
          transition: all 0.65s ease;
        }
        .landing-btn-primary:hover {
          filter: brightness(1.06);
          transform: translateY(-1px);
        }
        .landing-btn-outline {
          border: 1px solid ${BRAND.goldBorder};
          color: ${BRAND.gold};
          background: rgba(10, 10, 10, 0.32);
          border-radius: 6px;
          padding: 10px 14px;
          transition: all 0.65s ease;
        }
        .landing-btn-outline:hover {
          background: ${BRAND.gold};
          color: ${BRAND.bg};
          border-color: ${BRAND.gold};
        }
        .landing-link {
          color: rgba(245, 240, 232, 0.5);
          transition: color 0.2s ease;
          font-size: 14px;
          text-decoration: none;
          display: block;
        }
        .landing-link:hover {
          color: ${BRAND.text};
        }
        .landing-input {
          border: 1px solid ${BRAND.goldBorder};
          background: rgba(10, 10, 10, 0.5);
          color: ${BRAND.text};
          border-radius: 6px;
          padding: 12px 14px;
          outline: none;
        }
        .landing-input:focus {
          border-color: ${BRAND.gold};
          box-shadow: 0 0 0 3px ${BRAND.goldMuted};
        }
        .landing-footer-heading {
          color: ${BRAND.gold};
          font-family: DM Sans, sans-serif;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .footer-links {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 1fr;
          row-gap: 32px;
        }
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 2fr 1.5fr 1.5fr;
            column-gap: 64px;
            row-gap: 48px;
          }
        }
        .waveform {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 28px;
          margin-top: 8px;
        }
        .bar {
          width: 3px;
          height: 20px;
          background: #c9a84c;
          border-radius: 2px;
          animation: wave 1s ease-in-out infinite;
          transform-origin: bottom center;
        }
        @keyframes wave {
          0%,
          100% {
            transform: scaleY(0.3);
          }
          50% {
            transform: scaleY(1);
          }
        }
        .phone-corner {
          position: absolute;
          width: 16px;
          height: 16px;
          border-color: ${BRAND.gold};
          border-style: solid;
          border-width: 0;
          opacity: 0.95;
        }
        .phone-corner.tl {
          left: 8px;
          top: 8px;
          border-top-width: 2px;
          border-left-width: 2px;
        }
        .phone-corner.tr {
          right: 8px;
          top: 8px;
          border-top-width: 2px;
          border-right-width: 2px;
        }
        .phone-corner.bl {
          left: 8px;
          bottom: 8px;
          border-bottom-width: 2px;
          border-left-width: 2px;
        }
        .phone-corner.br {
          right: 8px;
          bottom: 8px;
          border-bottom-width: 2px;
          border-right-width: 2px;
        }
        .how-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 24px;
          position: relative;
        }
        .how-card {
          z-index: 2;
        }
        .how-num {
          position: absolute;
          top: -26px;
          right: 8px;
          font-family: Cormorant Garamond, serif;
          font-weight: 300;
          font-size: clamp(96px, 12vw, 140px);
          color: rgba(201, 168, 76, 0.08);
          line-height: 1;
        }
        .how-title {
          color: ${BRAND.text};
          font-size: 22px;
          font-family: Cormorant Garamond, serif;
          position: relative;
          z-index: 2;
        }
        .how-desc {
          margin-top: 8px;
          color: ${BRAND.textSecondary};
          font-size: 16px;
          line-height: 1.7;
          max-width: 320px;
          position: relative;
          z-index: 2;
        }
        .how-dashed {
          display: none;
        }
        @media (min-width: 768px) {
          .how-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .how-dashed {
            display: block;
            position: absolute;
            left: 10%;
            right: 10%;
            top: 45%;
            border-top: 1px dashed rgba(201, 168, 76, 0.2);
            z-index: 1;
          }
        }
        @media (max-width: 767px) {
          .landing-section {
            padding-top: 100px;
            padding-bottom: 100px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          html:focus-within {
            scroll-behavior: auto;
          }
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </main>
  );
}
