import { useState, useEffect } from "react";
import { LanguageCode } from "@/lib/constants";

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageCode>("vi");
  const [isAutoDetected, setIsAutoDetected] = useState(true);

  useEffect(() => {
    // Check localStorage
    const saved = localStorage.getItem("language");
    if (saved) {
      setLanguage(saved as LanguageCode);
      setIsAutoDetected(false);
      return;
    }

    // Auto-detect from browser
    const browserLang = navigator.language.toLowerCase();
    let detected: LanguageCode = "en";

    if (browserLang.startsWith("vi")) detected = "vi";
    else if (browserLang.startsWith("fr")) detected = "fr";
    else if (browserLang.startsWith("ja")) detected = "ja";
    else if (browserLang.startsWith("ko")) detected = "ko";
    else if (browserLang.startsWith("zh")) detected = "zh";

    setLanguage(detected);
    setIsAutoDetected(true);
  }, []);

  const changeLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    setIsAutoDetected(false);
    localStorage.setItem("language", lang);
  };

  return { language, changeLanguage, isAutoDetected };
}
