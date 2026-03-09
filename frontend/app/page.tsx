import type { Metadata } from "next";
import LandingPageClient from "@/components/LandingPageClient";

const SITE_URL = "https://guideqr.ai";
const TITLE = "MuseAI by GuideQR.ai | AI Voice Guide for Museums";
const DESCRIPTION =
  "MuseAI turns museum visits into real-time multilingual voice experiences: scan QR, recognize exhibits, and talk to an AI guide instantly.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "MuseAI",
  keywords: [
    "MuseAI",
    "GuideQR.ai",
    "AI museum guide",
    "museum audio guide",
    "QR museum guide",
    "multilingual museum guide",
    "real-time voice guide",
    "museum digital transformation",
    "museum visitor engagement",
    "ai guide for museums",
    "museum narration with ai",
  ],
  alternates: {
    canonical: "/",
    languages: {
      en: "/?lang=en",
      vi: "/?lang=vi",
      de: "/?lang=de",
      ru: "/?lang=ru",
      ar: "/?lang=ar",
      es: "/?lang=es",
      fr: "/?lang=fr",
      ja: "/?lang=ja",
      ko: "/?lang=ko",
      zh: "/?lang=zh",
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "MuseAI by GuideQR.ai",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function HomePage() {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GuideQR.ai",
    url: SITE_URL,
    brand: {
      "@type": "Brand",
      name: "MuseAI",
    },
    sameAs: ["https://guideqr.ai"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@guideqr.ai",
        availableLanguage: ["vi", "en", "de", "ru", "ar", "es", "fr", "ja", "ko", "zh"],
      },
    ],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MuseAI by GuideQR.ai",
    url: SITE_URL,
    inLanguage: ["vi", "en", "de", "ru", "ar", "es", "fr", "ja", "ko", "zh"],
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MuseAI",
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: DESCRIPTION,
    featureList: [
      "Real-time AI voice guide",
      "Multilingual support (VI EN ES FR JA KO ZH)",
      "QR-first museum access",
      "Camera exhibit recognition",
      "Grounded museum knowledge base",
      "Admin CMS and analytics",
    ],
    provider: {
      "@type": "Organization",
      name: "GuideQR.ai",
      url: SITE_URL,
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Do visitors need to download anything?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. MuseAI works entirely in the mobile browser.",
        },
      },
      {
        "@type": "Question",
        name: "Which languages are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "MuseAI supports Vietnamese, English, German, Russian, Arabic, Spanish, French, Japanese, Korean, and Chinese.",
        },
      },
      {
        "@type": "Question",
        name: "How does AI know about exhibits?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Museums upload verified exhibit content in the admin dashboard. MuseAI answers from this grounded knowledge base.",
        },
      },
      {
        "@type": "Question",
        name: "How quickly can a museum go live?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Most museums can launch within 24 hours.",
        },
      },
      {
        "@type": "Question",
        name: "Is visitor data private?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "MuseAI stores anonymous analytics only and does not store personal visitor data.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingPageClient />
    </>
  );
}
