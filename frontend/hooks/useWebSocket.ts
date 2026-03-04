import { useState, useEffect, useCallback, useRef } from "react";
import { WS_BACKEND_URL } from "@/lib/constants";

type WSMessage = {
  type: string;
  audio?: string;
  text?: string;
  [key: string]: any;
};

export function useWebSocket(artifactId: string | null, language: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const MAX_RETRY = 3;

  const connect = useCallback(() => {
    if (!artifactId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;

    const wsUrl = `${WS_BACKEND_URL}/ws/persona/${artifactId}?language=${language}`;
    console.log("🔌 Connecting to:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WS opened");
      isConnectingRef.current = false;
      retryCountRef.current = 0;
      shouldReconnectRef.current = true;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨", data.type, "received");
        setMessages((prev) => [...prev, data]);
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    };

    ws.onclose = (event) => {
      console.log("❌ WS closed, code:", event.code, "wasClean:", event.wasClean);
      isConnectingRef.current = false;
      wsRef.current = null;
      setIsConnected(false);

      if (!shouldReconnectRef.current) return;

      if (retryCountRef.current < MAX_RETRY) {
        retryCountRef.current++;
        const delay = 2000 * retryCountRef.current;
        console.log(`⏳ Reconnecting in ${delay}ms (${retryCountRef.current}/${MAX_RETRY})...`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        console.error("❌ Max retries reached");
      }
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
    };
  }, [artifactId, language]);

  useEffect(() => {
    if (!artifactId) return;

    const timer = setTimeout(() => {
      connect();
    }, 100);

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(timer);
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
  }, [artifactId, language, connect]);

  const sendMessage = useCallback((message: WSMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ Cannot send: WS not open, state:", ws?.readyState);
      return;
    }
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("❌ Send error:", error);
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close(1000, "Manual disconnect");
  }, []);

  return { isConnected, messages, sendMessage, disconnect };
}
