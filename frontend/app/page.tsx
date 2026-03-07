"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRScanner, { QRScanPayload } from "@/components/QRScanner";
import { LanguageCode } from "@/lib/constants";

type LandingLang = Extract<LanguageCode, "en" | "vi" | "fr" | "ja" | "ko" | "zh">;

const LANG_OPTIONS: { code: LandingLang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "vi", label: "VI" },
  { code: "fr", label: "FR" },
  { code: "ja", label: "JP" },
  { code: "ko", label: "KR" },
  { code: "zh", label: "ZH" },
];

const COPY: Record<LandingLang, Record<string, string>> = {
  en: {
    powered: "✦ Powered by Gemini Live API",
    heroTitle: "Your AI Museum Guide",
    heroSub: "Point your phone at any exhibit. Ask anything. Get answers in real-time — in your language.",
    ctaScan: "📷 Scan QR to Enter Museum",
    ctaHint: "Find the QR code at the museum entrance",
    forMuseums: "For Museums",
    howTitle: "How It Works",
    step1Title: "Find the QR",
    step1Desc: "Look for the MuseAI QR code at the museum entrance or near exhibits",
    step2Title: "Scan & Enter",
    step2Desc: "Scan with your phone — no app download required",
    step3Title: "Talk & Discover",
    step3Desc: "Ask your AI guide anything about the exhibits in real-time",
    featuresTitle: "Core Features",
    f1Title: "Real-time Voice Guide",
    f1Desc: "Natural conversation with AI. Interrupt, ask follow-ups, go deep on any topic.",
    f2Title: "6 Languages",
    f2Desc: "Vietnamese • English • French • Japanese • Korean • Chinese",
    f3Title: "Zero Installation",
    f3Desc: "Just a QR code. Works on any smartphone browser instantly.",
    stat1: "Museums in Vietnam",
    stat2: "Supported Languages",
    stat3: "Apps to Download",
    museumsTitle: "Bring AI to Your Museum",
    museumsDesc: "Give every visitor a personal guide in their language. No staff required.",
    b1: "Setup in minutes, not months",
    b2: "Works with existing exhibits",
    b3: "Analytics dashboard included",
    b4: "Custom AI persona per museum",
    b5: "Supports 6 languages out of the box",
    getStarted: "Get Started",
    contactAdmin: "Contact / Admin Login",
    invalidQr: "Invalid QR code",
    nonSystemQr: "This QR code is not from a MuseAI museum",
    cameraPerm: "Camera permission is required. Please enable camera access.",
    footerPrivacy: "Privacy",
    footerContact: "Contact",
  },
  vi: {
    powered: "✦ Powered by Gemini Live API",
    heroTitle: "Hướng dẫn viên AI của bạn",
    heroSub: "Hướng điện thoại vào hiện vật. Hỏi bất cứ điều gì. Nhận câu trả lời theo thời gian thực bằng ngôn ngữ của bạn.",
    ctaScan: "📷 Quét QR để vào bảo tàng",
    ctaHint: "Tìm mã QR ở cổng vào bảo tàng",
    forMuseums: "Dành cho bảo tàng",
    howTitle: "Cách hoạt động",
    step1Title: "Tìm mã QR",
    step1Desc: "Tìm mã QR MuseAI ở cổng vào hoặc gần hiện vật",
    step2Title: "Quét và vào",
    step2Desc: "Quét bằng điện thoại — không cần cài app",
    step3Title: "Hỏi và khám phá",
    step3Desc: "Hỏi AI về hiện vật theo thời gian thực",
    featuresTitle: "Tính năng nổi bật",
    f1Title: "Thuyết minh giọng nói real-time",
    f1Desc: "Trò chuyện tự nhiên với AI. Ngắt lời, hỏi tiếp, đào sâu mọi chủ đề.",
    f2Title: "6 ngôn ngữ",
    f2Desc: "Tiếng Việt • English • Français • 日本語 • 한국어 • 中文",
    f3Title: "Không cần cài đặt",
    f3Desc: "Chỉ cần mã QR. Mở trình duyệt điện thoại là dùng ngay.",
    stat1: "Bảo tàng tại Việt Nam",
    stat2: "Ngôn ngữ hỗ trợ",
    stat3: "Ứng dụng cần tải",
    museumsTitle: "Mang AI đến bảo tàng của bạn",
    museumsDesc: "Mang đến cho mỗi khách tham quan một hướng dẫn viên cá nhân bằng ngôn ngữ của họ. Không cần thêm nhân sự.",
    b1: "Thiết lập trong vài phút, không phải vài tháng",
    b2: "Tương thích với hiện vật sẵn có",
    b3: "Có sẵn dashboard phân tích",
    b4: "Tuỳ chỉnh AI persona theo bảo tàng",
    b5: "Hỗ trợ sẵn 6 ngôn ngữ",
    getStarted: "Bắt đầu",
    contactAdmin: "Liên hệ / Đăng nhập Admin",
    invalidQr: "QR code không hợp lệ",
    nonSystemQr: "QR code này không thuộc hệ thống MuseAI",
    cameraPerm: "Cần quyền camera. Vui lòng bật quyền truy cập camera.",
    footerPrivacy: "Quyền riêng tư",
    footerContact: "Liên hệ",
  },
  fr: {
    powered: "✦ Powered by Gemini Live API",
    heroTitle: "Votre guide IA du musée",
    heroSub: "Pointez votre téléphone vers un objet. Posez n'importe quelle question. Obtenez des réponses en temps réel dans votre langue.",
    ctaScan: "📷 Scanner le QR pour entrer",
    ctaHint: "Trouvez le QR à l'entrée du musée",
    forMuseums: "Pour les musées",
    howTitle: "Comment ça marche",
    step1Title: "Trouvez le QR",
    step1Desc: "Cherchez le QR MuseAI à l'entrée ou près des objets",
    step2Title: "Scannez et entrez",
    step2Desc: "Scannez avec votre téléphone — aucune application à installer",
    step3Title: "Parlez et découvrez",
    step3Desc: "Posez des questions à votre guide IA en temps réel",
    featuresTitle: "Fonctionnalités clés",
    f1Title: "Guide vocal en temps réel",
    f1Desc: "Conversation naturelle avec l'IA. Interrompez, relancez, approfondissez.",
    f2Title: "6 langues",
    f2Desc: "Vietnamien • Anglais • Français • Japonais • Coréen • Chinois",
    f3Title: "Zéro installation",
    f3Desc: "Juste un QR code. Fonctionne instantanément dans le navigateur.",
    stat1: "Musées au Vietnam",
    stat2: "Langues prises en charge",
    stat3: "Applications à télécharger",
    museumsTitle: "Apportez l'IA à votre musée",
    museumsDesc: "Offrez à chaque visiteur un guide personnel dans sa langue.",
    b1: "Installation en quelques minutes",
    b2: "Compatible avec vos objets existants",
    b3: "Tableau de bord analytique inclus",
    b4: "Persona IA personnalisable",
    b5: "6 langues prises en charge",
    getStarted: "Commencer",
    contactAdmin: "Contact / Admin Login",
    invalidQr: "Code QR invalide",
    nonSystemQr: "Ce QR code ne provient pas d'un musée MuseAI",
    cameraPerm: "L'autorisation caméra est requise.",
    footerPrivacy: "Confidentialité",
    footerContact: "Contact",
  },
  ja: {
    powered: "✦ Powered by Gemini Live API",
    heroTitle: "あなたのAIミュージアムガイド",
    heroSub: "展示物にスマホを向けて質問するだけ。リアルタイムであなたの言語で回答します。",
    ctaScan: "📷 QRをスキャンして入館",
    ctaHint: "博物館入口のQRコードを見つけてください",
    forMuseums: "博物館向け",
    howTitle: "使い方",
    step1Title: "QRを見つける",
    step1Desc: "入口や展示物付近のMuseAI QRを探します",
    step2Title: "スキャンして入る",
    step2Desc: "スマホでスキャン。アプリ不要",
    step3Title: "話して発見",
    step3Desc: "AIガイドにリアルタイムで質問",
    featuresTitle: "主な機能",
    f1Title: "リアルタイム音声ガイド",
    f1Desc: "自然な会話。割り込みや深掘り質問も可能。",
    f2Title: "6言語対応",
    f2Desc: "ベトナム語 • 英語 • フランス語 • 日本語 • 韓国語 • 中国語",
    f3Title: "インストール不要",
    f3Desc: "QRを読むだけでブラウザですぐ利用可能。",
    stat1: "ベトナムの博物館",
    stat2: "対応言語",
    stat3: "ダウンロード不要アプリ",
    museumsTitle: "博物館にAIを導入",
    museumsDesc: "来館者ごとに母語で案内する個別ガイドを提供。",
    b1: "数分で導入",
    b2: "既存展示に対応",
    b3: "分析ダッシュボード付き",
    b4: "博物館別AIペルソナ",
    b5: "6言語を標準サポート",
    getStarted: "はじめる",
    contactAdmin: "お問い合わせ / 管理者ログイン",
    invalidQr: "無効なQRコードです",
    nonSystemQr: "MuseAI博物館のQRコードではありません",
    cameraPerm: "カメラ権限が必要です。",
    footerPrivacy: "プライバシー",
    footerContact: "お問い合わせ",
  },
  ko: {
    powered: "✦ Powered by Gemini Live API",
    heroTitle: "당신의 AI 박물관 가이드",
    heroSub: "전시물에 휴대폰을 비추고 질문하세요. 실시간으로 당신의 언어로 답변합니다.",
    ctaScan: "📷 QR 스캔 후 입장",
    ctaHint: "박물관 입구의 QR 코드를 찾으세요",
    forMuseums: "박물관용",
    howTitle: "이용 방법",
    step1Title: "QR 찾기",
    step1Desc: "입구 또는 전시물 근처 MuseAI QR을 찾으세요",
    step2Title: "스캔하고 입장",
    step2Desc: "휴대폰으로 스캔 — 앱 설치 불필요",
    step3Title: "대화하며 탐색",
    step3Desc: "AI 가이드에게 실시간 질문",
    featuresTitle: "핵심 기능",
    f1Title: "실시간 음성 가이드",
    f1Desc: "자연스러운 대화, 끊기/후속 질문/심화 질문 가능",
    f2Title: "6개 언어",
    f2Desc: "베트남어 • 영어 • 프랑스어 • 일본어 • 한국어 • 중국어",
    f3Title: "설치 없음",
    f3Desc: "QR 코드만으로 스마트폰 브라우저에서 즉시 사용",
    stat1: "베트남 박물관",
    stat2: "지원 언어",
    stat3: "다운로드할 앱",
    museumsTitle: "박물관에 AI 도입",
    museumsDesc: "방문객에게 각자 언어로 개인 가이드를 제공합니다.",
    b1: "몇 분 내 설정",
    b2: "기존 전시와 호환",
    b3: "분석 대시보드 제공",
    b4: "박물관별 AI 페르소나",
    b5: "기본 6개 언어 지원",
    getStarted: "시작하기",
    contactAdmin: "문의 / 관리자 로그인",
    invalidQr: "유효하지 않은 QR 코드",
    nonSystemQr: "MuseAI 박물관 QR 코드가 아닙니다",
    cameraPerm: "카메라 권한이 필요합니다.",
    footerPrivacy: "개인정보",
    footerContact: "문의",
  },
  zh: {
    powered: "✦ Powered by Gemini Live API",
    heroTitle: "您的 AI 博物馆导览",
    heroSub: "将手机对准展品并提问。系统将以您的语言实时回答。",
    ctaScan: "📷 扫码进入博物馆",
    ctaHint: "请在博物馆入口寻找二维码",
    forMuseums: "面向博物馆",
    howTitle: "使用流程",
    step1Title: "找到二维码",
    step1Desc: "在入口或展品附近找到 MuseAI 二维码",
    step2Title: "扫码进入",
    step2Desc: "手机扫码即可，无需安装应用",
    step3Title: "对话探索",
    step3Desc: "实时向 AI 导览提问",
    featuresTitle: "核心功能",
    f1Title: "实时语音导览",
    f1Desc: "自然对话，可打断、追问、深度讲解。",
    f2Title: "6种语言",
    f2Desc: "越南语 • 英语 • 法语 • 日语 • 韩语 • 中文",
    f3Title: "零安装",
    f3Desc: "只需二维码，手机浏览器即开即用。",
    stat1: "越南博物馆",
    stat2: "支持语言",
    stat3: "需下载应用",
    museumsTitle: "为博物馆引入 AI",
    museumsDesc: "为每位访客提供其语言的专属导览。",
    b1: "几分钟完成部署",
    b2: "兼容现有展品",
    b3: "内置数据分析看板",
    b4: "可自定义博物馆 AI 角色",
    b5: "开箱支持 6 种语言",
    getStarted: "立即开始",
    contactAdmin: "联系 / 管理员登录",
    invalidQr: "无效二维码",
    nonSystemQr: "该二维码不属于 MuseAI 博物馆",
    cameraPerm: "需要相机权限，请先开启。",
    footerPrivacy: "隐私",
    footerContact: "联系",
  },
};

function detectVisitorLanguage(): LandingLang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("lang");
  if (saved && LANG_OPTIONS.some((x) => x.code === saved)) return saved as LandingLang;

  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("vi")) return "vi";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("en")) return "en";
  return "en";
}

export default function HomePage() {
  const router = useRouter();
  const [lang, setLang] = useState<LandingLang>("en");
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "error" | "ok" } | null>(null);

  const c = COPY[lang];

  useEffect(() => {
    setLang(detectVisitorLanguage());
  }, []);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    localStorage.setItem("language", lang);
  }, [lang]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleScanResult = (payload: QRScanPayload) => {
    if (payload.error) {
      setShowScanner(false);
      if (payload.error === "non_system") {
        setToast({ text: c.nonSystemQr, kind: "error" });
      } else if (payload.error === "unreadable") {
        setToast({ text: c.cameraPerm, kind: "error" });
      } else {
        setToast({ text: c.invalidQr, kind: "error" });
      }
      return;
    }

    const museumId = payload.museum_id;
    const exhibitId = payload.exhibit_id || payload.artifact_id;
    if (museumId) localStorage.setItem("museum_id", museumId);

    setShowScanner(false);

    if (museumId && exhibitId) {
      router.push(`/welcome?museum=${encodeURIComponent(museumId)}&exhibit=${encodeURIComponent(exhibitId)}&lang=${lang}`);
      return;
    }

    if (museumId) {
      router.push(`/welcome?museum=${encodeURIComponent(museumId)}&lang=${lang}`);
      return;
    }

    if (exhibitId) {
      router.push(`/exhibit/${encodeURIComponent(exhibitId)}?lang=${lang}`);
      return;
    }

    setToast({ text: c.invalidQr, kind: "error" });
  };

  const scrollToMuseums = () => {
    document.getElementById("for-museums")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stats = useMemo(
    () => [
      { n: "197+", label: c.stat1 },
      { n: "6", label: c.stat2 },
      { n: "0", label: c.stat3 },
    ],
    [c]
  );

  return (
    <div style={{ background: "#0A0A0A", color: "#F5F0E8" }}>
      <nav className="fixed top-0 left-0 right-0 z-40" style={{ background: "rgba(10,10,10,0.88)", borderBottom: "1px solid rgba(201,168,76,0.15)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div style={{ color: "#C9A84C", fontFamily: "Cormorant Garamond, serif", fontSize: 30, lineHeight: 1 }}>MuseAI</div>
            <div style={{ opacity: 0.65, fontSize: 12, fontFamily: "DM Sans" }}>by GuideQR.ai</div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LandingLang)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: "1px solid rgba(201,168,76,0.25)", background: "#111111", color: "#F5F0E8", fontFamily: "DM Sans" }}
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button onClick={scrollToMuseums} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C" }}>
              {c.forMuseums}
            </button>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 pt-28 md:pt-32 min-h-screen grid md:grid-cols-5 gap-8 items-center">
        <div className="md:col-span-3">
          <div className="inline-flex items-center rounded-full px-3 py-1 mb-5" style={{ border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", fontSize: 12, fontFamily: "DM Sans" }}>
            {c.powered}
          </div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "clamp(42px,7vw,78px)", lineHeight: 0.95 }}>{c.heroTitle}</h1>
          <p className="mt-5 max-w-xl" style={{ color: "rgba(245,240,232,0.82)", fontFamily: "DM Sans", fontSize: 18, lineHeight: 1.6 }}>
            {c.heroSub}
          </p>

          <button onClick={() => setShowScanner(true)} className="mt-7 px-6 py-4 rounded-2xl text-lg font-medium transition-all" style={{ background: "#C9A84C", color: "#0A0A0A", fontFamily: "DM Sans" }}>
            {c.ctaScan}
          </button>
          <p className="mt-3 text-sm" style={{ color: "rgba(245,240,232,0.58)", fontFamily: "DM Sans" }}>{c.ctaHint}</p>
        </div>

        <div className="md:col-span-2 hidden md:block">
          <div className="rounded-3xl p-4" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "#111111" }}>
            <img src="https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800" alt="Museum interior" loading="lazy" className="w-full h-[440px] object-cover rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: "Cormorant Garamond, serif", color: "#C9A84C" }}>{c.howTitle}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[{ i: "🔳", t: c.step1Title, d: c.step1Desc }, { i: "📱", t: c.step2Title, d: c.step2Desc }, { i: "🎤", t: c.step3Title, d: c.step3Desc }].map((s) => (
            <div key={s.t} className="rounded-2xl p-5" style={{ border: "1px solid rgba(201,168,76,0.15)", background: "#111111" }}>
              <div className="text-2xl mb-3">{s.i}</div>
              <div className="text-xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>{s.t}</div>
              <p style={{ fontFamily: "DM Sans", color: "rgba(245,240,232,0.76)", lineHeight: 1.5 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: "Cormorant Garamond, serif", color: "#C9A84C" }}>{c.featuresTitle}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[{ i: "🎙️", t: c.f1Title, d: c.f1Desc }, { i: "🌐", t: c.f2Title, d: c.f2Desc }, { i: "⚡", t: c.f3Title, d: c.f3Desc }].map((f) => (
            <div key={f.t} className="rounded-2xl p-5" style={{ border: "1px solid rgba(201,168,76,0.15)", background: "#111111" }}>
              <div className="text-2xl mb-3">{f.i}</div>
              <div className="text-xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>{f.t}</div>
              <p style={{ fontFamily: "DM Sans", color: "rgba(245,240,232,0.76)", lineHeight: 1.5 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-2xl p-5 md:p-8 grid md:grid-cols-3 gap-4" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "#111111" }}>
          {stats.map((s, idx) => (
            <div key={s.n + s.label} className="text-center md:text-left md:px-6" style={{ borderRight: idx < 2 ? "1px solid rgba(201,168,76,0.2)" : "none" }}>
              <div style={{ fontSize: 42, color: "#C9A84C", fontFamily: "Cormorant Garamond, serif" }}>{s.n}</div>
              <div style={{ fontFamily: "DM Sans", color: "rgba(245,240,232,0.76)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="for-museums" className="max-w-6xl mx-auto px-4 py-16">
        <div className="rounded-2xl p-6 md:p-10" style={{ background: "#111111", borderTop: "1px solid rgba(201,168,76,0.35)", borderLeft: "1px solid rgba(201,168,76,0.15)", borderRight: "1px solid rgba(201,168,76,0.15)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
          <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: "Cormorant Garamond, serif", color: "#C9A84C" }}>{c.museumsTitle}</h2>
          <p className="mb-8" style={{ fontFamily: "DM Sans", color: "rgba(245,240,232,0.78)" }}>{c.museumsDesc}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <ul className="space-y-3" style={{ fontFamily: "DM Sans" }}>
              {[c.b1, c.b2, c.b3, c.b4, c.b5].map((b) => (
                <li key={b} className="flex items-start gap-2"><span style={{ color: "#C9A84C" }}>✓</span><span>{b}</span></li>
              ))}
            </ul>

            <div className="rounded-2xl p-6" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "rgba(10,10,10,0.75)" }}>
              <div className="text-2xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif", color: "#C9A84C" }}>{c.getStarted}</div>
              <button onClick={() => router.push("/admin/login")} className="mt-3 px-5 py-3 rounded-xl" style={{ background: "#C9A84C", color: "#0A0A0A", fontFamily: "DM Sans", fontWeight: 600 }}>
                {c.contactAdmin}
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            <div style={{ color: "#C9A84C", fontFamily: "Cormorant Garamond, serif", fontSize: 22, lineHeight: 1 }}>MuseAI</div>
            <div style={{ fontFamily: "DM Sans", opacity: 0.66, fontSize: 12 }}>© 2026 GuideQR.ai — MuseAI</div>
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ fontFamily: "DM Sans" }}>
            <button onClick={() => router.push("/admin/login")}>Admin Login</button>
            <a href="#">{c.footerPrivacy}</a>
            <a href="mailto:hello@guideqr.ai">{c.footerContact}</a>
          </div>
        </div>
      </footer>

      {toast && (
        <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-6 px-4 py-3 rounded-xl" style={{ background: toast.kind === "error" ? "#7f1d1d" : "#14532d", border: `1px solid ${toast.kind === "error" ? "#f87171" : "#86efac"}`, color: "#F5F0E8", fontFamily: "DM Sans" }}>
          {toast.text}
        </div>
      )}

      {showScanner && <QRScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} language={lang} />}
    </div>
  );
}
