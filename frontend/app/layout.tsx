import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MuseAI — Museum Voice Guide",
  description: "Real-time AI voice guide for museums",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var lastTouchEnd = 0;
                document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });
                document.addEventListener("gesturechange", function (e) { e.preventDefault(); }, { passive: false });
                document.addEventListener("gestureend", function (e) { e.preventDefault(); }, { passive: false });
                document.addEventListener("touchmove", function (e) {
                  if (e.touches && e.touches.length > 1) e.preventDefault();
                }, { passive: false });
                document.addEventListener("touchend", function (e) {
                  var now = Date.now();
                  if (now - lastTouchEnd <= 300) e.preventDefault();
                  lastTouchEnd = now;
                }, { passive: false });
              })();
            `,
          }}
        />
      </head>
      <body className={`${cormorant.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}
