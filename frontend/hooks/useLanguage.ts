import { useState, useEffect } from "react";
import { LanguageCode } from "@/lib/constants";

const SUPPORTED: LanguageCode[] = ["vi", "en", "fr", "ja", "ko", "zh"];

function detectBrowserLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const navLang = (navigator.language || "").toLowerCase();
  if (navLang.startsWith("vi")) return "vi";
  if (navLang.startsWith("en")) return "en";
  if (navLang.startsWith("fr")) return "fr";
  if (navLang.startsWith("ja")) return "ja";
  if (navLang.startsWith("ko")) return "ko";
  if (navLang.startsWith("zh")) return "zh";
  return "en";
}

function readInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("language");
  if (saved && SUPPORTED.includes(saved as LanguageCode)) {
    return saved as LanguageCode;
  }
  return detectBrowserLanguage();
}

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageCode>(readInitialLanguage);
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
