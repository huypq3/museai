export type LandingLang = "vi" | "en" | "de" | "ru" | "ar" | "fr" | "ja" | "ko" | "zh" | "es";

export const SUPPORTED_LANDING_LANGS: LandingLang[] = ["vi", "en", "de", "ru", "ar", "fr", "ja", "ko", "zh", "es"];

export type LandingMessages = {
  heroTitleA: string;
  heroTitleB: string;
  demoBadge: string;
  demoSubtitle: string;
  demoCtaPrimary: string;
  demoCtaReassurance: string;
  demoVideoPlaceholder: string;
  demoVideoAriaLabel: string;
};

export const LANDING_I18N: Record<LandingLang, LandingMessages> = {
  en: {
    heroTitleA: "Every Exhibit Has a Story.",
    heroTitleB: "Now It Can Tell It.",
    demoBadge: "+ AI-Powered Museum Experience",
    demoSubtitle: "Real-time AI voice guide · 10 languages · No app needed",
    demoCtaPrimary: "Scan QR to Begin",
    demoCtaReassurance: "No app download required · Works on any smartphone",
    demoVideoPlaceholder: "Loading demo video...",
    demoVideoAriaLabel: "MuseAI demo video",
  },
  vi: {
    heroTitleA: "Mỗi Hiện Vật Đều Có Câu Chuyện.",
    heroTitleB: "Giờ Nó Có Thể Kể Cho Bạn Nghe.",
    demoBadge: "+ Trải Nghiệm Bảo Tàng Với AI",
    demoSubtitle: "Hướng dẫn giọng nói AI · 10 ngôn ngữ · Không cần cài app",
    demoCtaPrimary: "Quét QR Để Bắt Đầu",
    demoCtaReassurance: "Không cần tải app · Dùng được trên mọi điện thoại",
    demoVideoPlaceholder: "Đang tải video demo...",
    demoVideoAriaLabel: "Video giới thiệu MuseAI",
  },
  de: {
    heroTitleA: "Jedes Exponat Hat Eine Geschichte.",
    heroTitleB: "Jetzt Kann Es Sie Erzählen.",
    demoBadge: "+ KI-gestütztes Museumserlebnis",
    demoSubtitle: "KI-Sprachführung in Echtzeit · 10 Sprachen · Keine App nötig",
    demoCtaPrimary: "QR-Code zum Start scannen",
    demoCtaReassurance: "Kein App-Download erforderlich · Funktioniert auf jedem Smartphone",
    demoVideoPlaceholder: "Demo-Video wird geladen...",
    demoVideoAriaLabel: "MuseAI Demo-Video",
  },
  ru: {
    heroTitleA: "У Каждого Экспоната Есть История.",
    heroTitleB: "Теперь Он Может Рассказать Её Сам.",
    demoBadge: "+ Музейный Опыт с ИИ",
    demoSubtitle: "Голосовой ИИ-гид в реальном времени · 10 языков · Без установки приложения",
    demoCtaPrimary: "Сканировать QR, чтобы начать",
    demoCtaReassurance: "Без скачивания приложения · Работает на любом смартфоне",
    demoVideoPlaceholder: "Загрузка демо-видео...",
    demoVideoAriaLabel: "Демо-видео MuseAI",
  },
  ar: {
    heroTitleA: "لكل قطعة أثرية قصة.",
    heroTitleB: "الآن يمكنها أن ترويها لك.",
    demoBadge: "+ تجربة متحف مدعومة بالذكاء الاصطناعي",
    demoSubtitle: "دليل صوتي بالذكاء الاصطناعي في الوقت الحقيقي · 10 لغات · بدون تطبيق",
    demoCtaPrimary: "امسح رمز QR للبدء",
    demoCtaReassurance: "لا حاجة لتنزيل تطبيق · يعمل على أي هاتف ذكي",
    demoVideoPlaceholder: "جارٍ تحميل فيديو العرض...",
    demoVideoAriaLabel: "فيديو MuseAI التجريبي",
  },
  fr: {
    heroTitleA: "Chaque Œuvre a une Histoire.",
    heroTitleB: "Maintenant Elle Peut la Raconter.",
    demoBadge: "+ Expérience Muséale Propulsée par l'IA",
    demoSubtitle: "Guide vocal IA en temps réel · 10 langues · Sans installation",
    demoCtaPrimary: "Scanner le QR pour Commencer",
    demoCtaReassurance: "Aucune application requise · Compatible avec tous les smartphones",
    demoVideoPlaceholder: "Chargement de la vidéo...",
    demoVideoAriaLabel: "Vidéo de démonstration MuseAI",
  },
  ja: {
    heroTitleA: "すべての展示品には物語がある。",
    heroTitleB: "今、それが語りかけます。",
    demoBadge: "+ AI搭載ミュージアム体験",
    demoSubtitle: "リアルタイムAI音声ガイド · 10言語対応 · アプリ不要",
    demoCtaPrimary: "QRコードをスキャンして開始",
    demoCtaReassurance: "アプリのダウンロード不要 · あらゆるスマートフォンで利用可能",
    demoVideoPlaceholder: "デモ動画を読み込み中...",
    demoVideoAriaLabel: "MuseAIデモ動画",
  },
  ko: {
    heroTitleA: "모든 전시품에는 이야기가 있습니다.",
    heroTitleB: "이제 그것이 직접 말합니다.",
    demoBadge: "+ AI 뮤지엄 경험",
    demoSubtitle: "실시간 AI 음성 가이드 · 10개 언어 · 앱 설치 불필요",
    demoCtaPrimary: "QR 스캔으로 시작하기",
    demoCtaReassurance: "앱 다운로드 불필요 · 모든 스마트폰 지원",
    demoVideoPlaceholder: "데모 영상 로딩 중...",
    demoVideoAriaLabel: "MuseAI 데모 영상",
  },
  zh: {
    heroTitleA: "每件展品都有一个故事。",
    heroTitleB: "现在它可以亲口告诉你。",
    demoBadge: "+ AI 博物馆体验",
    demoSubtitle: "实时AI语音导览 · 10种语言 · 无需安装应用",
    demoCtaPrimary: "扫描二维码开始",
    demoCtaReassurance: "无需下载应用 · 支持所有智能手机",
    demoVideoPlaceholder: "演示视频加载中...",
    demoVideoAriaLabel: "MuseAI演示视频",
  },
  es: {
    heroTitleA: "Cada Pieza Tiene una Historia.",
    heroTitleB: "Ahora Puede Contártela.",
    demoBadge: "+ Experiencia Museística con IA",
    demoSubtitle: "Guía de voz IA en tiempo real · 10 idiomas · Sin instalación",
    demoCtaPrimary: "Escanear QR para Comenzar",
    demoCtaReassurance: "Sin descarga de app · Compatible con cualquier smartphone",
    demoVideoPlaceholder: "Cargando video de demostración...",
    demoVideoAriaLabel: "Video de demostración de MuseAI",
  },
};

export function detectLandingLanguage(): LandingLang {
  if (typeof window === "undefined") return "en";

  const urlLang = new URLSearchParams(window.location.search).get("lang");
  if (urlLang && SUPPORTED_LANDING_LANGS.includes(urlLang as LandingLang)) {
    return urlLang as LandingLang;
  }

  const saved =
    localStorage.getItem("museai_locale") ||
    localStorage.getItem("lang") ||
    localStorage.getItem("language");
  if (saved && SUPPORTED_LANDING_LANGS.includes(saved as LandingLang)) {
    return saved as LandingLang;
  }

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of browserLanguages) {
    const exact = (lang || "").toLowerCase();
    if (SUPPORTED_LANDING_LANGS.includes(exact as LandingLang)) {
      return exact as LandingLang;
    }
    const prefix = exact.split("-")[0];
    if (SUPPORTED_LANDING_LANGS.includes(prefix as LandingLang)) {
      return prefix as LandingLang;
    }
  }

  return "en";
}
