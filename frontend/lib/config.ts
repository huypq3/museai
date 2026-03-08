const RAW_BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function runningOnHttps(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

function ensureHttps(url: string): string {
  if (runningOnHttps() && /^http:\/\//i.test(url)) {
    console.warn("Auto-upgrading backend URL from http:// to https://", url);
    return url.replace(/^http:\/\//i, "https://");
  }
  return url;
}

function resolveBackendUrl(): string {
  if (!RAW_BACKEND_URL) {
    if (!IS_PRODUCTION) {
      return "http://localhost:8080";
    }
    throw new Error("NEXT_PUBLIC_BACKEND_URL is required in production builds");
  }

  const isLocalhostHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(RAW_BACKEND_URL);

  if (IS_PRODUCTION && /^http:\/\//i.test(RAW_BACKEND_URL) && !isLocalhostHttp) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL must use https:// in production builds");
  }

  if (RAW_BACKEND_URL.startsWith("//")) {
    return runningOnHttps() ? `https:${RAW_BACKEND_URL}` : `http:${RAW_BACKEND_URL}`;
  }

  return ensureHttps(RAW_BACKEND_URL);
}

function toWebSocketUrl(url: string): string {
  return url.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
}

export const CONFIG = {
  BACKEND_URL: resolveBackendUrl(),
  WS_URL: toWebSocketUrl(resolveBackendUrl()),
  IS_PRODUCTION,
} as const;
