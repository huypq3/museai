import { useState, useEffect } from "react";
import { LanguageCode } from "@/lib/constants";

const SUPPORTED: LanguageCode[] = ["vi", "en", "de", "ru", "ar", "es", "fr", "ja", "ko", "zh"];

function detectBrowserLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const navLang = (navigator.language || "").toLowerCase();
  if (navLang.startsWith("vi")) return "vi";
  if (navLang.startsWith("en")) return "en";
  if (navLang.startsWith("de")) return "de";
  if (navLang.startsWith("ru")) return "ru";
  if (navLang.startsWith("ar")) return "ar";
  if (navLang.startsWith("fr")) return "fr";
  if (navLang.startsWith("es")) return "es";
  if (navLang.startsWith("ja")) return "ja";
  if (navLang.startsWith("ko")) return "ko";
  if (navLang.startsWith("zh")) return "zh";
  return "en";
}

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [isAutoDetected, setIsAutoDetected] = useState(false);

  useEffect(() => {
    // Keep local state aligned with persisted user preference.
    const saved = localStorage.getItem("language");
    if (saved && SUPPORTED.includes(saved as LanguageCode)) {
      setLanguage(saved as LanguageCode);
      setIsAutoDetected(false);
      return;
    }
    setLanguage(detectBrowserLanguage());
    setIsAutoDetected(true);
  }, []);

  const changeLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    setIsAutoDetected(false);
    localStorage.setItem("language", lang);
  };

  return { language, changeLanguage, isAutoDetected };
}
