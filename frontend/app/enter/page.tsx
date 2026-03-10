"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createExhibitSession } from "@/lib/api";

type EnterStatus = "loading" | "error";

export default function EnterPage() {
  const router = useRouter();
  const [status, setStatus] = useState<EnterStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const exhibitId = query.get("exhibit");
    const museumId = query.get("museum");

    if (!exhibitId || !museumId) {
      setErrorMsg("Invalid QR code. Please scan again.");
      setStatus("error");
      return;
    }
    const safeExhibitId = exhibitId;
    const safeMuseumId = museumId;

    let cancelled = false;
    async function startSession() {
      try {
        const data = await createExhibitSession(safeExhibitId, safeMuseumId);
        if (cancelled) return;
        router.replace(data.redirect_url);
      } catch {
        if (cancelled) return;
        setErrorMsg("Unable to start session. Please scan QR again.");
        setStatus("error");
      }
    }

    startSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
          color: "#F5F0E8",
          gap: "16px",
          fontFamily: "DM Sans",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid #333",
            borderTop: "3px solid #C9A84C",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "#888", fontSize: "14px" }}>Starting your guide...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0A0A",
        color: "#F5F0E8",
        gap: "16px",
        fontFamily: "DM Sans",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "32px" }}>⚠️</p>
      <p style={{ color: "#F5F0E8" }}>{errorMsg}</p>
      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: "16px",
          padding: "12px 24px",
          background: "#C9A84C",
          color: "#0A0A0A",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Back to Home
      </button>
    </div>
  );
}
