"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AdminArtifactQrLegacyRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    router.replace(`/admin/exhibits/${id}/qr`);
  }, [id, router]);

  return null;
}
