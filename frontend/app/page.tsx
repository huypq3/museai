"use client";

import { useEffect, useMemo, useState } from "react";
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

const STATS = [
  { value: "197+", key: "statMuseumsLabel" as const },
  { value: "7", key: "statLangLabel" as const },
  { value: "0", key: "statAppsLabel" as const },
  { value: "<2s", key: "statLatencyLabel" as const },
];

const FEATURE_ITEMS = [
  { icon: "🎙️", title: "f1Title", desc: "f1Desc" },
  { icon: "📷", title: "f2Title", desc: "f2Desc" },
  { icon: "🧭", title: "f3Title", desc: "f3Desc" },
  { icon: "🌐", title: "f4Title", desc: "f4Desc" },
  { icon: "⚡", title: "f5Title", desc: "f5Desc" },
  { icon: "📊", title: "f6Title", desc: "f6Desc" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState<LandingLang>("en");
  const [openScanner, setOpenScanner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number>(0);

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
    const exhibitId = payload.exhibit_id || payload.artifact_id;

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
          transition: "all 0.6s ease",
        }}
      >
        <div className="mx-auto max-w-7xl h-full px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 28 }}>MuseAI</span>
            <span style={{ width: 1, height: 26, background: "rgba(201,168,76,0.3)" }} />
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
            <button onClick={() => scrollTo("visitors")} className="landing-link">
              {tr.navVisitors}
            </button>
            <button onClick={() => scrollTo("for-museums")} className="landing-link">
              {tr.navMuseums}
            </button>
            <button onClick={() => scrollTo("features")} className="landing-link">
              {tr.navFeatures}
            </button>
            <button onClick={() => scrollTo("how-it-works")} className="landing-link">
              {tr.navHow}
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => {
                const next = e.target.value as LandingLang;
                if (SUPPORTED_LANDING_LANGS.includes(next)) setLanguage(next);
              }}
              style={{
                background: BRAND.surface,
                border: `1px solid ${BRAND.goldBorder}`,
                color: BRAND.text,
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 12,
              }}
              aria-label="Language"
            >
              {SUPPORTED_LANDING_LANGS.map((code) => (
                <option key={code} value={code}>
                  {`${LANGUAGE_LABELS[code].flag} ${LANGUAGE_LABELS[code].code}`}
                </option>
              ))}
            </select>
            <span style={{ width: 1, height: 22, background: "rgba(201,168,76,0.3)" }} />
            <Link href="/admin/login" className="landing-link">
              {tr.navAdmin}
            </Link>
            <button onClick={() => setOpenScanner(true)} className="landing-btn-outline">
              {tr.navScan}
            </button>
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
              padding: "12px 16px 18px",
            }}
          >
            <div className="flex flex-col gap-3">
              <button className="landing-link text-left" onClick={() => scrollTo("visitors")}>{tr.navVisitors}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("for-museums")}>{tr.navMuseums}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("features")}>{tr.navFeatures}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("how-it-works")}>{tr.navHow}</button>
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LandingLang)}
                  style={{
                    background: BRAND.surface,
                    border: `1px solid ${BRAND.goldBorder}`,
                    color: BRAND.text,
                    borderRadius: 6,
                    padding: "8px 10px",
                    fontSize: 12,
                    flex: 1,
                  }}
                >
                  {SUPPORTED_LANDING_LANGS.map((code) => (
                    <option key={code} value={code}>{`${LANGUAGE_LABELS[code].flag} ${LANGUAGE_LABELS[code].code}`}</option>
                  ))}
                </select>
                <button onClick={() => setOpenScanner(true)} className="landing-btn-outline">{tr.navScan}</button>
              </div>
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
        <div className="mx-auto max-w-7xl px-4 md:px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="landing-eyebrow" style={{ marginBottom: 18 }}>{tr.powered}</div>
            <h1
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontWeight: 500,
                lineHeight: 0.95,
                fontSize: "clamp(54px, 8vw, 84px)",
                maxWidth: 740,
              }}
            >
              {tr.heroTitleA}
              <br />
              <span style={{ color: BRAND.gold, fontStyle: "italic" }}>{tr.heroTitleB}</span>
            </h1>
            <p style={{ marginTop: 24, maxWidth: 540, color: BRAND.textSecondary, fontSize: 18, lineHeight: 1.7 }}>
              {tr.heroSubtitle}
            </p>
            <div style={{ marginTop: 30, width: 80, height: 1, background: "rgba(201,168,76,0.5)" }} />
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <button className="landing-btn-primary" onClick={() => setOpenScanner(true)}>
                {tr.heroPrimary}
              </button>
              <button className="landing-link" onClick={() => scrollTo("for-museums")}>
                {tr.heroSecondary}
              </button>
            </div>
            <p style={{ marginTop: 12, color: BRAND.textMuted, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {tr.heroCaption}
            </p>
          </div>

          <div className="hidden md:block">
            <div
              style={{
                border: `1px solid ${BRAND.goldBorder}`,
                background: BRAND.surface,
                borderRadius: 8,
                padding: 18,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=85"
                alt="Museum interior"
                loading="lazy"
                style={{ width: "100%", height: 460, objectFit: "cover", borderRadius: 6, opacity: 0.5 }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 30,
                  border: `1px solid ${BRAND.goldBorder}`,
                  borderRadius: 8,
                  background: "rgba(10,10,10,0.68)",
                  backdropFilter: "blur(2px)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ color: BRAND.gold, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tr.phoneStatus}</div>
                  <div style={{ marginTop: 8, fontFamily: "Cormorant Garamond, serif", fontSize: 28 }}>Tượng Trần Hưng Đạo</div>
                </div>
                <div className="flex items-end gap-1 h-10" aria-hidden>
                  {Array.from({ length: 28 }).map((_, idx) => (
                    <span
                      key={idx}
                      className="landing-wave"
                      style={{
                        width: 4,
                        height: `${8 + (idx % 8) * 2}px`,
                        background: BRAND.gold,
                        animationDelay: `${idx * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ zIndex: 2, position: "relative", background: BRAND.surface, borderTop: `1px solid ${BRAND.goldBorder}`, borderBottom: `1px solid ${BRAND.goldBorder}` }}>
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.value + stat.key} className="text-center lg:text-left">
              <div style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 52, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ color: BRAND.textSecondary, marginTop: 6, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tr[stat.key]}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="visitors" className="landing-section" style={{ zIndex: 2, position: "relative" }}>
        <div className="mx-auto max-w-7xl px-4 md:px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <div className="landing-label">{tr.visitorsEyebrow}</div>
            <h2 className="landing-title" style={{ marginTop: 16 }}>{tr.visitorsTitle}</h2>
            <div className="grid md:grid-cols-3 gap-4 mt-8">
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
            <button className="landing-btn-outline mt-8" onClick={() => setOpenScanner(true)}>
              {tr.visitorsCta}
            </button>
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
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="landing-label">{tr.howEyebrow}</div>
          <h2 className="landing-title" style={{ marginTop: 14 }}>{tr.howTitle}</h2>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {[
              { n: "01", t: tr.how1Title, d: tr.how1Desc },
              { n: "02", t: tr.how2Title, d: tr.how2Desc },
              { n: "03", t: tr.how3Title, d: tr.how3Desc },
            ].map((step) => (
              <article key={step.n} className="landing-card" style={{ position: "relative", overflow: "hidden", minHeight: 210 }}>
                <span style={{ position: "absolute", top: -22, right: 8, fontFamily: "Cormorant Garamond, serif", fontSize: 110, color: "rgba(201,168,76,0.08)", lineHeight: 1 }}>
                  {step.n}
                </span>
                <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 30 }}>{step.t}</h3>
                <p style={{ marginTop: 8, color: BRAND.textSecondary, lineHeight: 1.7 }}>{step.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="landing-section" style={{ paddingTop: 0, zIndex: 2, position: "relative" }}>
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="landing-label">{tr.featuresEyebrow}</div>
          <h2 className="landing-title" style={{ marginTop: 14 }}>{tr.featuresTitle}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {FEATURE_ITEMS.map((item) => (
              <article key={item.title} className="landing-card landing-feature-card">
                <div style={{ fontSize: 26 }}>{item.icon}</div>
                <h3 style={{ marginTop: 10, fontFamily: "Cormorant Garamond, serif", fontSize: 31 }}>{tr[item.title]}</h3>
                <p style={{ marginTop: 8, color: BRAND.textSecondary, lineHeight: 1.7 }}>{tr[item.desc]}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="for-museums" className="landing-section" style={{ zIndex: 2, position: "relative", background: BRAND.surface, borderTop: `1px solid ${BRAND.goldBorder}` }}>
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="landing-label">{tr.museumsEyebrow}</div>
          <h2 className="landing-title" style={{ marginTop: 14, maxWidth: 800 }}>{tr.museumsTitle}</h2>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-8 mt-10 items-start">
            <div className="grid grid-cols-3 gap-3">
              {[{ n: "~$15,000", l: tr.roi1Label }, { n: "$299", l: tr.roi2Label }, { n: "98%", l: tr.roi3Label }].map((roi) => (
                <div key={roi.n} className="landing-card" style={{ textAlign: "center" }}>
                  <div style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 40 }}>{roi.n}</div>
                  <div style={{ marginTop: 5, color: BRAND.textSecondary, fontSize: 12 }}>{roi.l}</div>
                </div>
              ))}
            </div>

            <div className="landing-card" style={{ background: BRAND.card }}>
              <ul className="space-y-2">
                {[tr.m1, tr.m2, tr.m3, tr.m4, tr.m5, tr.m6, tr.m7].map((it) => (
                  <li key={it} style={{ display: "flex", gap: 10, color: BRAND.textSecondary }}>
                    <span style={{ color: BRAND.gold }}>✦</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="mt-8"
            style={{
              border: `1px solid ${BRAND.goldBorder}`,
              borderRadius: 8,
              padding: 24,
              background: "radial-gradient(55% 100% at 0% 0%, rgba(201,168,76,0.11), rgba(22,22,22,0.92) 70%)",
              boxShadow: "0 0 60px rgba(201,168,76,0.08)",
            }}
          >
            <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 40, color: BRAND.gold }}>{tr.earlyTitle}</h3>
            <p style={{ color: BRAND.textSecondary, marginTop: 8 }}>{tr.earlySubtitle}</p>
            <div className="mt-5 grid md:grid-cols-[1fr_1fr_auto] gap-3">
              <input className="landing-input" placeholder={tr.museumInput} />
              <input className="landing-input" placeholder={tr.emailInput} />
              <button className="landing-btn-primary" onClick={() => router.push("/admin/login")}>{tr.earlyBtn}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 88, zIndex: 2, position: "relative" }}>
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="landing-title" style={{ textAlign: "center" }}>{tr.faqTitle}</h2>
          <div className="mt-8 space-y-3">
            {faqItems.map((item, idx) => {
              const open = idx === expandedFaq;
              return (
                <article key={item.q} className="landing-card" style={{ padding: 0, overflow: "hidden" }}>
                  <button
                    onClick={() => setExpandedFaq(open ? -1 : idx)}
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
        <div className="mx-auto max-w-4xl px-4 md:px-6 text-center">
          <h2 className="landing-title">{tr.finalTitle}</h2>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="landing-btn-primary" onClick={() => router.push("/admin/login")}>{tr.finalPrimary}</button>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="landing-link">{tr.finalSecondary} ↗</a>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${BRAND.goldBorder}`, position: "relative", zIndex: 2 }}>
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 grid md:grid-cols-4 gap-8">
          <div>
            <div style={{ color: BRAND.gold, fontFamily: "Cormorant Garamond, serif", fontSize: 28 }}>MuseAI</div>
            <div style={{ color: BRAND.textMuted, marginTop: 8, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Point. Scan. Discover.
            </div>
            <div style={{ marginTop: 12, color: BRAND.textSecondary, fontSize: 13 }}>{tr.footerCopy}</div>
          </div>
          <div>
            <div className="landing-footer-heading">{tr.footerProduct}</div>
            <div className="space-y-2 mt-3">
              <button className="landing-link text-left" onClick={() => scrollTo("features")}>{tr.navFeatures}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("how-it-works")}>{tr.navHow}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("for-museums")}>{tr.navMuseums}</button>
              <button className="landing-link text-left" onClick={() => scrollTo("visitors")}>{tr.navVisitors}</button>
            </div>
          </div>
          <div>
            <div className="landing-footer-heading">{tr.footerResources}</div>
            <div className="space-y-2 mt-3">
              <Link className="landing-link" href="/admin/login">{tr.navAdmin}</Link>
              <a className="landing-link" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </div>
          <div>
            <div className="landing-footer-heading">{tr.footerContact}</div>
            <div className="space-y-2 mt-3">
              <a className="landing-link" href="mailto:hello@guideqr.ai">hello@guideqr.ai</a>
              <a className="landing-link" href="https://guideqr.ai" target="_blank" rel="noreferrer">guideqr.ai</a>
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
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: ${BRAND.textMuted};
          font-weight: 500;
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
          color: ${BRAND.textSecondary};
          transition: color 0.6s ease;
        }
        .landing-link:hover {
          color: ${BRAND.gold};
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
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .landing-wave {
          display: block;
          border-radius: 3px;
          animation: landingWave 1.1s ease-in-out infinite;
        }
        @keyframes landingWave {
          0%,
          100% {
            transform: scaleY(0.35);
            opacity: 0.45;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
        @media (max-width: 767px) {
          .landing-section {
            padding-top: 84px;
            padding-bottom: 84px;
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
