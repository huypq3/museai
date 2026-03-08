const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

function normalizeBackendUrl(rawUrl: string): string {
  // On HTTPS pages, force HTTPS backend to avoid mixed-content blocking.
  if (typeof window !== "undefined" && window.location.protocol === "https:" && rawUrl.startsWith("http://")) {
    return rawUrl.replace(/^http:\/\//, "https://");
  }
  return rawUrl;
}

export const BACKEND_URL = normalizeBackendUrl(RAW_BACKEND_URL);
export const WS_BACKEND_URL = BACKEND_URL.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");

export const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export type LanguageCode = "vi" | "en" | "es" | "fr" | "ja" | "ko" | "zh";
