"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminArtifactsNewLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const museum = params.get("museum");
    const q = museum ? `?museum=${encodeURIComponent(museum)}` : "";
    router.replace(`/admin/exhibits/new${q}`);
  }, [router]);

  return null;
}
