import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MuseAI - AI Museum Voice Guide",
  description: "AI museum guide powered by Gemini Live",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
