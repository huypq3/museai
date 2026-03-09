import { CONFIG } from "./config";

export const BACKEND_URL = CONFIG.BACKEND_URL;
export const WS_BACKEND_URL = CONFIG.WS_URL;

export function getBackendUrl(): string {
  return CONFIG.BACKEND_URL;
}

export function getWsBackendUrl(): string {
  return CONFIG.WS_URL;
}

export const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
] as const;

export type LanguageCode = "vi" | "en" | "de" | "ru" | "ar" | "es" | "fr" | "ja" | "ko" | "zh";
