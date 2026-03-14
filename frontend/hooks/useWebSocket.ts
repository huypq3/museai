import { useState, useEffect, useCallback, useRef } from "react";
import { BACKEND_URL, WS_BACKEND_URL } from "@/lib/constants";

type WSMessage = {
  type: string;
  audio?: string;
  text?: string;
  data?: string;
  reason?: string;
  code?: string | number;
  seconds_left?: number;
  [key: string]: unknown;
};

type WSNotice = {
  code: number;
  reason: string;
  messageVi: string;
  messageEn: string;
  reconnectAllowed: boolean;
};

type UseWebSocketOptions = {
  onAudioChunk?: (base64: string) => void;
  onControlMessage?: (msg: any) => void;
  autoConnect?: boolean;
};

const MAX_RETRY_DEFAULT = 5;

function mapCloseToNotice(code: number, reason: string): WSNotice {
  switch (code) {
    case 1000:
      return {
        code,
        reason: reason || "normal",
        messageVi: "Session ended.",
        messageEn: "Session ended.",
        reconnectAllowed: true,
      };
    case 1001:
      return {
        code,
        reason: reason || "going_away",
        messageVi: "Connection closed because page/app was left.",
        messageEn: "Connection closed because page/app was left.",
        reconnectAllowed: true,
      };
    case 1008:
    case 4003:
      return {
        code,
        reason: reason || "rate_limit",
        messageVi: "Rate limit reached. Please wait and retry.",
        messageEn: "Rate limit reached. Please wait and retry.",
        reconnectAllowed: true,
      };
    case 4001:
      return {
        code,
        reason: reason || "inactivity",
        messageVi: "Session closed due to inactivity.",
        messageEn: "Session closed due to inactivity.",
        reconnectAllowed: true,
      };
    case 4002:
      return {
        code,
        reason: reason || "max_duration",
        messageVi: "Session reached maximum duration.",
        messageEn: "Session reached maximum duration.",
        reconnectAllowed: true,
      };
    case 4010:
      return {
        code,
        reason: reason || "hard_limit",
        messageVi: "Session hit hard server limit, please reconnect.",
        messageEn: "Session hit hard server limit, please reconnect.",
        reconnectAllowed: true,
      };
    case 4011:
      return {
        code,
        reason: reason || "heartbeat_timeout",
        messageVi: "Network heartbeat timeout.",
        messageEn: "Network heartbeat timeout.",
        reconnectAllowed: true,
      };
    case 1011:
      return {
        code,
        reason: reason || "server_error",
        messageVi: "Server internal error. Retrying connection.",
        messageEn: "Server internal error. Retrying connection.",
        reconnectAllowed: true,
      };
    default:
      return {
        code,
        reason: reason || "unexpected_close",
        messageVi: "Connection interrupted. Retrying.",
        messageEn: "Connection interrupted. Retrying.",
        reconnectAllowed: true,
      };
  }
}

export function useWebSocket(exhibitId: string | null, language: string, options?: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [notice, setNotice] = useState<WSNotice | null>(null);
  const autoConnect = options?.autoConnect ?? true;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const shouldAutoReconnectRef = useRef(true);
  const connectLanguageRef = useRef(language);
  const onAudioChunkRef = useRef<UseWebSocketOptions["onAudioChunk"]>(options?.onAudioChunk);
  const onControlMessageRef = useRef<UseWebSocketOptions["onControlMessage"]>(options?.onControlMessage);
  const MAX_RETRY = MAX_RETRY_DEFAULT;

  useEffect(() => {
    onAudioChunkRef.current = options?.onAudioChunk;
    onControlMessageRef.current = options?.onControlMessage;
  }, [options?.onAudioChunk, options?.onControlMessage]);

  const connect = useCallback(async () => {
    if (!exhibitId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;
    let wsToken = "";
    try {
      let tokenResp = await fetch(`${BACKEND_URL}/api/session/token/${exhibitId}`, {
        method: "POST",
      });
      if (!tokenResp.ok) {
        // Legacy fallback
        tokenResp = await fetch(`${BACKEND_URL}/api/session/token/${exhibitId}`, {
          method: "POST",
        });
      }
      if (!tokenResp.ok) {
        throw new Error(`session token request failed: ${tokenResp.status}`);
      }
      const tokenPayload = await tokenResp.json();
      wsToken = tokenPayload?.token || "";
    } catch (error) {
      console.error("❌ Failed to get WS session token:", error);
      isConnectingRef.current = false;
      setIsConnected(false);
      return;
    }

    const wsLang = connectLanguageRef.current;
    const wsUrl = `${WS_BACKEND_URL}/ws/persona/${exhibitId}?language=${wsLang}&token=${encodeURIComponent(wsToken)}`;
    console.log("🔌 Connecting to:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WS opened");
      isConnectingRef.current = false;
      retryCountRef.current = 0;
      shouldReconnectRef.current = true;
      shouldAutoReconnectRef.current = true;
      setIsConnected(true);
      setNotice(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Heartbeat response path.
        if (data.type === "ping") {
          try {
            ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          } catch (e) {
            console.warn("⚠️ Failed to send pong:", e);
          }
          return;
        }

        // Hot path: audio bypasses React state entirely.
        if (data.type === "audio_chunk") {
          if (typeof data.audio === "string") {
            onAudioChunkRef.current?.(data.audio);
          }
          return; // do NOT call setMessages or any setState
        }

        // Control messages only.
        if (process.env.NODE_ENV !== "production") {
          console.log("📨", data.type);
        }
        onControlMessageRef.current?.(data);

        if (data.type === "error" && (data.code === "WS_RATE_LIMIT" || data.code === "RATE_LIMIT")) {
          shouldAutoReconnectRef.current = false;
          const mapped = mapCloseToNotice(4003, "rate_limit");
          setNotice(mapped);
          return;
        }

        if (data.type === "session_end") {
          shouldAutoReconnectRef.current = false;
          const mapped = mapCloseToNotice(
            typeof data.code === "number" ? data.code : 1000,
            typeof data.reason === "string" ? data.reason : "session_end"
          );
          setNotice(mapped);
        }

        if (data.type === "session_warning") {
          return;
        }
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    };

    ws.onclose = (event) => {
      console.log("❌ WS closed, code:", event.code, "wasClean:", event.wasClean, "reason:", event.reason);
      isConnectingRef.current = false;
      wsRef.current = null;
      setIsConnected(false);
      const mapped = mapCloseToNotice(event.code, event.reason || "");
      setNotice(mapped);

      if (!shouldReconnectRef.current || !shouldAutoReconnectRef.current || !mapped.reconnectAllowed) return;
      if (
        event.code === 1000 ||
        event.code === 1001 ||
        event.code === 1008 ||
        event.code === 4003 ||
        event.code === 4401 ||
        event.code === 4403
      ) {
        return;
      }

      if (retryCountRef.current < MAX_RETRY) {
        retryCountRef.current++;
        // Exponential backoff + jitter to reduce thundering herd.
        const base = Math.min(30000, 1000 * 2 ** retryCountRef.current);
        const jitter = Math.floor(Math.random() * 400);
        const delay = base + jitter;
        console.log(`⏳ Reconnecting in ${delay}ms (${retryCountRef.current}/${MAX_RETRY})`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        console.error("❌ Max retries reached");
      }
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
    };
  }, [exhibitId, MAX_RETRY]);

  useEffect(() => {
    connectLanguageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!exhibitId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (autoConnect) {
      timer = setTimeout(() => {
        connect();
      }, 100);
    }

    return () => {
      shouldReconnectRef.current = false;
      if (timer) clearTimeout(timer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, "Component unmounted");
      }
      wsRef.current = null;
      isConnectingRef.current = false;
    };
  }, [exhibitId, connect, autoConnect]);

  const sendMessage = useCallback((message: WSMessage): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ Cannot send: WS not open, state:", ws?.readyState);
      return false;
    }
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("❌ Send error:", error);
      return false;
    }
  }, []);

  const sendTextMessage = useCallback((text: string): boolean => {
    const payload = (text || "").trim();
    if (!payload) return false;
    return sendMessage({
      type: "text_input",
      text: payload,
      language: connectLanguageRef.current,
    });
  }, [sendMessage]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    shouldAutoReconnectRef.current = false;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close(1000, "Manual disconnect");
  }, []);

  const reconnectNow = useCallback(() => {
    shouldReconnectRef.current = true;
    shouldAutoReconnectRef.current = true;
    retryCountRef.current = 0;
    void connect();
  }, [connect]);

  return { isConnected, notice, sendMessage, sendTextMessage, disconnect, reconnectNow, connect };
}
