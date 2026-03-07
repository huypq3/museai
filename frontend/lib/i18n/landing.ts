export type LandingLang = "vi" | "en" | "fr" | "ja" | "ko" | "zh" | "es";

export const SUPPORTED_LANDING_LANGS: LandingLang[] = ["vi", "en", "fr", "ja", "ko", "zh", "es"];

export const LANGUAGE_LABELS: Record<LandingLang, { code: string; flag: string }> = {
  vi: { code: "VI", flag: "🇻🇳" },
  en: { code: "EN", flag: "🇺🇸" },
  fr: { code: "FR", flag: "🇫🇷" },
  ja: { code: "JP", flag: "🇯🇵" },
  ko: { code: "KR", flag: "🇰🇷" },
  zh: { code: "ZH", flag: "🇨🇳" },
  es: { code: "ES", flag: "🇪🇸" },
};

export type LandingMessages = {
  navVisitors: string;
  navMuseums: string;
  navFeatures: string;
  navHow: string;
  navAdmin: string;
  navScan: string;
  powered: string;
  heroTitleA: string;
  heroTitleB: string;
  heroSubtitle: string;
  heroPrimary: string;
  heroSecondary: string;
  heroCaption: string;
  phoneStatus: string;
  statMuseumsLabel: string;
  statLangLabel: string;
  statAppsLabel: string;
  statLatencyLabel: string;
  visitorsEyebrow: string;
  visitorsTitle: string;
  vp1Title: string;
  vp1Desc: string;
  vp2Title: string;
  vp2Desc: string;
  vp3Title: string;
  vp3Desc: string;
  visitorsCta: string;
  howEyebrow: string;
  howTitle: string;
  how1Title: string;
  how1Desc: string;
  how2Title: string;
  how2Desc: string;
  how3Title: string;
  how3Desc: string;
  featuresEyebrow: string;
  featuresTitle: string;
  f1Title: string;
  f1Desc: string;
  f2Title: string;
  f2Desc: string;
  f3Title: string;
  f3Desc: string;
  f4Title: string;
  f4Desc: string;
  f5Title: string;
  f5Desc: string;
  f6Title: string;
  f6Desc: string;
  museumsEyebrow: string;
  museumsTitle: string;
  roi1Label: string;
  roi2Label: string;
  roi3Label: string;
  m1: string;
  m2: string;
  m3: string;
  m4: string;
  m5: string;
  m6: string;
  m7: string;
  earlyTitle: string;
  earlySubtitle: string;
  museumInput: string;
  emailInput: string;
  earlyBtn: string;
  faqTitle: string;
  faqQ1: string;
  faqA1: string;
  faqQ2: string;
  faqA2: string;
  faqQ3: string;
  faqA3: string;
  faqQ4: string;
  faqA4: string;
  faqQ5: string;
  faqA5: string;
  finalTitle: string;
  finalPrimary: string;
  finalSecondary: string;
  footerProduct: string;
  footerResources: string;
  footerContact: string;
  footerCopy: string;
  scanHint: string;
  toastInvalid: string;
  toastNotMuse: string;
  toastNoCamera: string;
};

const baseEn: LandingMessages = {
  navVisitors: "For Visitors",
  navMuseums: "For Museums",
  navFeatures: "Features",
  navHow: "How It Works",
  navAdmin: "Admin",
  navScan: "Scan QR",
  powered: "✦ AI-Powered Museum Experience",
  heroTitleA: "Every Exhibit Has a Story.",
  heroTitleB: "Now It Can Tell It.",
  heroSubtitle: "MuseAI transforms museum visits with real-time AI voice guidance — available in 7 languages, no application required.",
  heroPrimary: "📷 Scan QR Code to Begin",
  heroSecondary: "Learn about museum partnerships ->",
  heroCaption: "Locate the QR code at the museum entrance or beside any exhibit",
  phoneStatus: "● Audio Guide Live...",
  statMuseumsLabel: "Museums in Vietnam",
  statLangLabel: "Languages Supported",
  statAppsLabel: "Apps to Download",
  statLatencyLabel: "Voice Response Time",
  visitorsEyebrow: "FOR VISITORS",
  visitorsTitle: "Your Personal Guide, Always at Your Side",
  vp1Title: "Ask Freely",
  vp1Desc: "No tour schedule. Ask about anything.",
  vp2Title: "No Barriers",
  vp2Desc: "7 languages. Switch mid-conversation.",
  vp3Title: "Instant Access",
  vp3Desc: "Scan. Connect. Discover. Under 5 seconds.",
  visitorsCta: "Scan QR to Experience It",
  howEyebrow: "HOW IT WORKS",
  howTitle: "Three Steps. One New Museum Experience.",
  how1Title: "Scan the QR Code",
  how1Desc: "Find the QR code at the entrance or beside any exhibit.",
  how2Title: "AI Guide Connects",
  how2Desc: "Your browser opens a live AI guide. No download, no account.",
  how3Title: "Ask. Listen. Discover.",
  how3Desc: "Talk naturally in your language. Switch anytime.",
  featuresEyebrow: "FEATURES",
  featuresTitle: "Built for Modern Museums",
  f1Title: "Real-time Voice",
  f1Desc: "Gemini Live API, interruptible, context-aware.",
  f2Title: "Camera Recognition",
  f2Desc: "Point and identify exhibits instantly.",
  f3Title: "Grounded Knowledge",
  f3Desc: "AI speaks only from verified museum data.",
  f4Title: "7 Languages",
  f4Desc: "VI EN FR JA KO ZH ES.",
  f5Title: "Zero Installation",
  f5Desc: "PWA flow: QR to voice in around 5 seconds.",
  f6Title: "Analytics Dashboard",
  f6Desc: "Track engagement, languages, and sessions.",
  museumsEyebrow: "FOR MUSEUMS",
  museumsTitle: "Transform Visitor Experience. Reduce Operational Costs.",
  roi1Label: "Monthly human guide cost",
  roi2Label: "MuseAI Professional/month",
  roi3Label: "Estimated cost reduction",
  m1: "No technical expertise required",
  m2: "Upload exhibits in minutes",
  m3: "AI never fabricates information",
  m4: "Auto-generated QR codes",
  m5: "Real-time visitor analytics",
  m6: "Custom AI persona per museum",
  m7: "7 languages out of the box",
  earlyTitle: "Bring MuseAI to Your Museum",
  earlySubtitle: "Free during beta period.",
  museumInput: "Museum name",
  emailInput: "Work email",
  earlyBtn: "Request Early Access",
  faqTitle: "Frequently Asked Questions",
  faqQ1: "Do visitors need to download anything?",
  faqA1: "No. MuseAI works entirely in the mobile browser.",
  faqQ2: "Which languages are supported?",
  faqA2: "Vietnamese, English, Spanish, French, Japanese, Korean, and Chinese.",
  faqQ3: "How does AI know about our exhibits?",
  faqA3: "Museums upload verified data in admin dashboard. AI never fabricates details.",
  faqQ4: "How quickly can we go live?",
  faqA4: "Most museums can go live within 24 hours.",
  faqQ5: "Is visitor data private?",
  faqA5: "Only anonymous analytics are collected. No personal visitor data is stored.",
  finalTitle: "Ready to Give Your Museum a Voice?",
  finalPrimary: "Request Early Access",
  finalSecondary: "View on GitHub",
  footerProduct: "Product",
  footerResources: "Resources",
  footerContact: "Contact",
  footerCopy: "© 2026 GuideQR.ai · MuseAI",
  scanHint: "Point at a MuseAI QR code",
  toastInvalid: "Invalid QR code",
  toastNotMuse: "Not a MuseAI QR code",
  toastNoCamera: "Camera permission is required. Please enable camera access.",
};

export const LANDING_I18N: Record<LandingLang, LandingMessages> = {
  en: baseEn,
  vi: {
    ...baseEn,
    navVisitors: "Dành cho khách tham quan",
    navMuseums: "Dành cho bảo tàng",
    navFeatures: "Tính năng",
    navHow: "Cách hoạt động",
    navScan: "Quét QR",
    heroTitleA: "Mỗi hiện vật đều có một câu chuyện.",
    heroTitleB: "Giờ đây, chính nó có thể kể lại.",
    heroSubtitle: "MuseAI nâng tầm trải nghiệm bảo tàng với thuyết minh AI giọng nói thời gian thực — hỗ trợ 7 ngôn ngữ, không cần cài ứng dụng.",
    heroPrimary: "📷 Quét QR để bắt đầu",
    heroSecondary: "Tìm hiểu hợp tác cùng bảo tàng ->",
    heroCaption: "Tìm mã QR ở cổng vào bảo tàng hoặc bên cạnh hiện vật",
    phoneStatus: "● Đang thuyết minh...",
    statMuseumsLabel: "Bảo tàng tại Việt Nam",
    statLangLabel: "Ngôn ngữ hỗ trợ",
    statAppsLabel: "Ứng dụng cần tải",
    statLatencyLabel: "Thời gian phản hồi giọng nói",
    visitorsEyebrow: "CHO KHÁCH THAM QUAN",
    visitorsTitle: "Hướng dẫn viên cá nhân, luôn bên bạn",
    visitorsCta: "Quét QR để trải nghiệm",
    howEyebrow: "CÁCH HOẠT ĐỘNG",
    featuresEyebrow: "TÍNH NĂNG",
    museumsEyebrow: "CHO BẢO TÀNG",
    museumsTitle: "Nâng trải nghiệm khách tham quan. Giảm chi phí vận hành.",
    roi1Label: "Chi phí hướng dẫn viên/tháng",
    roi2Label: "MuseAI Professional/tháng",
    roi3Label: "Mức giảm chi phí ước tính",
    earlyTitle: "Mang MuseAI đến bảo tàng của bạn",
    earlySubtitle: "Miễn phí trong giai đoạn beta.",
    museumInput: "Tên bảo tàng",
    emailInput: "Email công việc",
    earlyBtn: "Đăng ký truy cập sớm",
    faqTitle: "Câu hỏi thường gặp",
    finalTitle: "Sẵn sàng trao giọng nói cho bảo tàng của bạn?",
    finalPrimary: "Đăng ký truy cập sớm",
    finalSecondary: "Xem trên GitHub",
    footerProduct: "Sản phẩm",
    footerResources: "Tài nguyên",
    footerContact: "Liên hệ",
    scanHint: "Hướng camera vào mã QR của MuseAI",
    toastInvalid: "QR không hợp lệ",
    toastNotMuse: "Không phải QR của MuseAI",
    toastNoCamera: "Cần quyền camera. Vui lòng bật quyền truy cập camera.",
  },
  fr: { ...baseEn, navVisitors: "Visiteurs", navMuseums: "Musées", navFeatures: "Fonctionnalités", navHow: "Comment ça marche", navScan: "Scanner QR" },
  ja: { ...baseEn, navVisitors: "来館者向け", navMuseums: "博物館向け", navFeatures: "機能", navHow: "使い方", navScan: "QRを読む" },
  ko: { ...baseEn, navVisitors: "방문객", navMuseums: "박물관", navFeatures: "기능", navHow: "이용 방법", navScan: "QR 스캔" },
  zh: { ...baseEn, navVisitors: "访客", navMuseums: "博物馆", navFeatures: "功能", navHow: "使用流程", navScan: "扫码" },
  es: { ...baseEn, navVisitors: "Visitantes", navMuseums: "Museos", navFeatures: "Funciones", navHow: "Cómo funciona", navScan: "Escanear QR" },
};

export const LANDING_FAQ_KEYS = [
  { q: "faqQ1", a: "faqA1" },
  { q: "faqQ2", a: "faqA2" },
  { q: "faqQ3", a: "faqA3" },
  { q: "faqQ4", a: "faqA4" },
  { q: "faqQ5", a: "faqA5" },
] as const;

export function detectLandingLanguage(): LandingLang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("lang");
  if (saved && SUPPORTED_LANDING_LANGS.includes(saved as LandingLang)) return saved as LandingLang;
  const browser = (navigator.language || "").toLowerCase().slice(0, 2);
  const map: Record<string, LandingLang> = {
    vi: "vi",
    en: "en",
    fr: "fr",
    ja: "ja",
    ko: "ko",
    zh: "zh",
    es: "es",
  };
  return map[browser] || "en";
}
