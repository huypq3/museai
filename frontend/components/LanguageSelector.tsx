"use client";

import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { LanguageCode } from "@/lib/constants";

type Props = {
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  isAutoDetected: boolean;
};

export default function LanguageSelector({ language, onChangeLanguage, isAutoDetected }: Props) {
  return (
    <div className="relative">
      <select
        value={language}
        onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
        className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
      {isAutoDetected && (
        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
          Auto
        </span>
      )}
    </div>
  );
}
