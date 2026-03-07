import { useState, useEffect } from "react";
import { LanguageCode } from "@/lib/constants";

const SUPPORTED: LanguageCode[] = ["vi", "en", "fr", "ja", "ko", "zh"];

function readInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "vi";
  const saved = localStorage.getItem("language");
  if (saved && SUPPORTED.includes(saved as LanguageCode)) {
    return saved as LanguageCode;
  }
  return "vi";
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
    setLanguage("vi");
    setIsAutoDetected(false);
  }, []);

  const changeLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    setIsAutoDetected(false);
    localStorage.setItem("language", lang);
  };

  return { language, changeLanguage, isAutoDetected };
}
