"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/useLanguage";
import { t } from "@/lib/i18n";

export default function ErrorPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const code = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") : null;

  const message = useMemo(() => {
    if (code === "MUSEUM_NOT_FOUND") return t(language, "error.museum_not_found");
    if (code === "MUSEUM_REQUIRED") return t(language, "error.museum_required");
    return t(language, "camera.invalid_qr");
  }, [code, language]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0A0A0A" }}>
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center"
        style={{ background: "#111111", border: "1px solid rgba(201,168,76,0.15)" }}
      >
        <div className="text-3xl mb-3">⚠️</div>
        <h1 className="font-display text-2xl mb-3" style={{ color: "#F5F0E8" }}>
          MuseAI
        </h1>
        <p style={{ color: "#F5F0E8", opacity: 0.85, fontFamily: "DM Sans", marginBottom: 20 }}>
          {message}
        </p>
        <button
          onClick={() => router.back()}
          className="px-5 py-3 rounded-xl"
          style={{ background: "#C9A84C", color: "#0A0A0A", fontFamily: "DM Sans", fontWeight: 600 }}
        >
          {t(language, "error.back")}
        </button>
      </div>
    </div>
  );
}
