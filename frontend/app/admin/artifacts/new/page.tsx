"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminArtifactsNewLegacyRedirect() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const museum = search.get("museum");
    const q = museum ? `?museum=${encodeURIComponent(museum)}` : "";
    router.replace(`/admin/exhibits/new${q}`);
  }, [router, search]);

  return null;
}
