import type { MetadataRoute } from "next";

const SITE_URL = "https://guideqr.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/welcome`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
