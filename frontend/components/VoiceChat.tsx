"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { t } from "@/lib/i18n";
import { BACKEND_URL, LanguageCode } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

type Props = {
  exhibitId: string;
  language: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  museumName?: string;
};

type State = "connecting" | "ready" | "paused" | "recording" | "processing" | "ai_speaking";

type Message = {
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
};

const WS_NOTICE_I18N: Record<
  LanguageCode,
  Record<string, string>
> = {
  vi: {
    normal: "Phiên đã kết thúc.",
    going_away: "Kết nối đã đóng do rời trang/ứng dụng.",
    rate_limit: "Bạn đang thao tác quá nhanh. Vui lòng chờ rồi thử lại.",
    inactivity: "Phiên đã đóng do không hoạt động.",
    max_duration: "Phiên đã đạt thời lượng tối đa.",
    hard_limit: "Phiên đã chạm giới hạn hệ thống. Vui lòng kết nối lại.",
    heartbeat_timeout: "Mất kết nối mạng tạm thời.",
    server_error: "Lỗi máy chủ. Vui lòng thử kết nối lại.",
    unexpected_close: "Kết nối bị gián đoạn. Vui lòng thử lại.",
  },
  en: {
    normal: "Session ended.",
    going_away: "Connection closed because page/app was left.",
    rate_limit: "Rate limit reached. Please wait and retry.",
    inactivity: "Session closed due to inactivity.",
    max_duration: "Session reached maximum duration.",
    hard_limit: "Session hit server limit. Please reconnect.",
    heartbeat_timeout: "Network heartbeat timeout.",
    server_error: "Server error. Please reconnect.",
    unexpected_close: "Connection interrupted. Please retry.",
  },
  de: {
    normal: "Sitzung beendet.",
    going_away: "Verbindung wurde geschlossen, weil die Seite/App verlassen wurde.",
    rate_limit: "Rate-Limit erreicht. Bitte warten und erneut versuchen.",
    inactivity: "Sitzung wegen Inaktivität geschlossen.",
    max_duration: "Maximale Sitzungsdauer erreicht.",
    hard_limit: "Serverlimit erreicht. Bitte neu verbinden.",
    heartbeat_timeout: "Netzwerk-Heartbeat-Timeout.",
    server_error: "Serverfehler. Bitte erneut verbinden.",
    unexpected_close: "Verbindung unterbrochen. Bitte erneut versuchen.",
  },
  ru: {
    normal: "Сессия завершена.",
    going_away: "Соединение закрыто из-за выхода со страницы/приложения.",
    rate_limit: "Лимит запросов достигнут. Подождите и попробуйте снова.",
    inactivity: "Сессия закрыта из-за неактивности.",
    max_duration: "Достигнута максимальная длительность сессии.",
    hard_limit: "Достигнут лимит сервера. Подключитесь снова.",
    heartbeat_timeout: "Таймаут сетевого heartbeat.",
    server_error: "Ошибка сервера. Переподключитесь.",
    unexpected_close: "Соединение прервано. Попробуйте снова.",
  },
  ar: {
    normal: "انتهت الجلسة.",
    going_away: "تم إغلاق الاتصال بسبب مغادرة الصفحة/التطبيق.",
    rate_limit: "تم الوصول إلى حد الطلبات. يرجى الانتظار ثم المحاولة مجددًا.",
    inactivity: "أُغلقت الجلسة بسبب عدم النشاط.",
    max_duration: "تم الوصول إلى الحد الأقصى لمدة الجلسة.",
    hard_limit: "وصلت الجلسة إلى حد الخادم. يرجى إعادة الاتصال.",
    heartbeat_timeout: "انتهت مهلة نبض الشبكة.",
    server_error: "خطأ في الخادم. يرجى إعادة الاتصال.",
    unexpected_close: "انقطع الاتصال. يرجى المحاولة مرة أخرى.",
  },
  es: {
    normal: "La sesión ha finalizado.",
    going_away: "La conexión se cerró al salir de la página/aplicación.",
    rate_limit: "Has alcanzado el límite. Espera e inténtalo de nuevo.",
    inactivity: "La sesión se cerró por inactividad.",
    max_duration: "La sesión alcanzó la duración máxima.",
    hard_limit: "La sesión alcanzó el límite del servidor. Reconecta.",
    heartbeat_timeout: "Tiempo de espera de red agotado.",
    server_error: "Error del servidor. Vuelve a conectar.",
    unexpected_close: "Conexión interrumpida. Inténtalo de nuevo.",
  },
  fr: {
    normal: "La session est terminée.",
    going_away: "Connexion fermée après avoir quitté la page/l'app.",
    rate_limit: "Limite atteinte. Veuillez patienter puis réessayer.",
    inactivity: "Session fermée pour inactivité.",
    max_duration: "La session a atteint sa durée maximale.",
    hard_limit: "La session a atteint la limite serveur. Reconnectez-vous.",
    heartbeat_timeout: "Délai réseau dépassé.",
    server_error: "Erreur serveur. Veuillez vous reconnecter.",
    unexpected_close: "Connexion interrompue. Veuillez réessayer.",
  },
  ja: {
    normal: "セッションが終了しました。",
    going_away: "ページ/アプリを離れたため接続が閉じられました。",
    rate_limit: "操作が多すぎます。しばらく待って再試行してください。",
    inactivity: "無操作のためセッションが終了しました。",
    max_duration: "セッション時間の上限に達しました。",
    hard_limit: "サーバー上限に達しました。再接続してください。",
    heartbeat_timeout: "ネットワーク接続がタイムアウトしました。",
    server_error: "サーバーエラーです。再接続してください。",
    unexpected_close: "接続が中断されました。再試行してください。",
  },
  ko: {
    normal: "세션이 종료되었습니다.",
    going_away: "페이지/앱을 벗어나 연결이 종료되었습니다.",
    rate_limit: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
    inactivity: "비활성으로 세션이 종료되었습니다.",
    max_duration: "세션 최대 시간이 초과되었습니다.",
    hard_limit: "서버 제한에 도달했습니다. 다시 연결해 주세요.",
    heartbeat_timeout: "네트워크 연결 시간이 초과되었습니다.",
    server_error: "서버 오류가 발생했습니다. 다시 연결해 주세요.",
    unexpected_close: "연결이 끊어졌습니다. 다시 시도해 주세요.",
  },
  zh: {
    normal: "会话已结束。",
    going_away: "离开页面/应用后连接已关闭。",
    rate_limit: "请求过于频繁，请稍后重试。",
    inactivity: "因长时间无操作，会话已关闭。",
    max_duration: "会话已达到最大时长。",
    hard_limit: "会话达到服务器限制，请重新连接。",
    heartbeat_timeout: "网络心跳超时。",
    server_error: "服务器错误，请重新连接。",
    unexpected_close: "连接中断，请重试。",
  },
};

function mergeTranscript(prev: string, incomingRaw: string): string {
  const incoming = incomingRaw.trim();
  if (!incoming) return prev;
  if (!prev) return incoming;
  if (incoming === prev) return prev;
  if (incoming.startsWith(prev)) return incoming;
  if (prev.startsWith(incoming)) return prev;
  if (prev.includes(incoming)) return prev;
  return `${prev} ${incoming}`;
}

const LANGUAGES: Record<LanguageCode, { flag: string }> = {
  vi: { flag: "🇻🇳" },
  en: { flag: "🇬🇧" },
  de: { flag: "🇩🇪" },
  ru: { flag: "🇷🇺" },
  ar: { flag: "🇸🇦" },
  es: { flag: "🇪🇸" },
  fr: { flag: "🇫🇷" },
  zh: { flag: "🇨🇳" },
  ja: { flag: "🇯🇵" },
  ko: { flag: "🇰🇷" },
};

export default function VoiceChat({ exhibitId, language, onLanguageChange, museumName }: Props) {
  const router = useRouter();
  const [state, _setState] = useState<State>("connecting");
  const stateRef = useRef<State>("connecting");
  const setState = (s: State) => { stateRef.current = s; _setState(s); };
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIText, setCurrentAIText] = useState("");
  const [currentUserText, setCurrentUserText] = useState("");
  const [exhibitName, setExhibitName] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showIntroButton, setShowIntroButton] = useState<boolean>(true);
  const [autoStopHint, setAutoStopHint] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const autoStopHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs that should not trigger re-renders
  const lastProcessedIndexRef = useRef<number>(-1);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForAudioRef = useRef(false);
  const pendingAITextRef = useRef("");
  const pendingUserTextRef = useRef("");
  const previousStateRef = useRef<"ready" | "paused">("ready");
  const hasAiOutputThisTurnRef = useRef(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  // When user interrupts, skip old-turn messages until next turn_complete.
  const skipOldTurnRef = useRef(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const { isConnected, messages: wsMessages, notice: wsNotice, sendMessage, sendTextMessage, reconnectNow } = useWebSocket(exhibitId, language);
  const { start, stop: stopRecording } = useAudioRecorder();
  const { playChunk, stopPlayback, stop: stopAudio, isPlaying, unlockAndFlush } = useAudioPlayer();
  const sentences = messages;

  const markIntroUsed = useCallback(() => {
    setShowIntroButton(false);
  }, []);

  // ─── Load exhibit name ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/exhibits/${exhibitId}`)
      .then((r) => r.json())
      .then((data) => setExhibitName(data.data?.name || ""))
      .catch((e) => console.error("Failed to load exhibit:", e));
  }, [exhibitId]);

  useEffect(() => {
    setShowIntroButton(true);
  }, [exhibitId]);

  // ─── Connect → ready ──────────────────────────────────────────────────
  useEffect(() => {
    if (isConnected && state === "connecting") {
      console.log("✅ WS connected → ready");
      // New socket session: never keep old-turn skip flag.
      skipOldTurnRef.current = false;
      setState("ready");
    }
    if (!isConnected) {
      // If user is waiting for response, keep processing UI instead of jumping to ready/ask button.
      if (stateRef.current === "processing") {
        console.warn("⚠️ WS disconnected while processing → keep processing state");
        return;
      }

      if (stateRef.current !== "connecting") {
        console.warn("⚠️ WS disconnected → connecting");
        clearTimeout(processingTimeoutRef.current ?? undefined);
        // Connection dropped before receiving turn_complete of old turn.
        // Reset skip so next session can process normally.
        skipOldTurnRef.current = false;
        setState("connecting");
      }
    }
  }, [isConnected]); // chỉ depend vào isConnected

  // Auto-greeting is handled by backend immediately after connect.

  // ─── When audio playback ends while waiting, return to ready ──────────
  useEffect(() => {
    if (!isPlaying && waitingForAudioRef.current) {
      // Do not override if user already started recording or is processing.
      if (stateRef.current === "recording" || stateRef.current === "processing") {
        waitingForAudioRef.current = false;
        return;
      }
      // Only return to ready if AI was actually in speaking state.
      if (stateRef.current !== "ai_speaking") {
        waitingForAudioRef.current = false;
        return;
      }
      console.log("🔇 Audio finished → ready");
      waitingForAudioRef.current = false;
      setState("ready");
    }
  }, [isPlaying]);

  // ─── Process WS messages (depends only on wsMessages) ─────────────────
  useEffect(() => {
    if (wsMessages.length === 0) return;

    const startIndex = lastProcessedIndexRef.current + 1;
    if (startIndex >= wsMessages.length) return;

    for (let i = startIndex; i < wsMessages.length; i++) {
      const msg = wsMessages[i];
      console.log(`[WS] type=${msg.type}`, msg.type === "audio_chunk" ? "(audio)" : "", `skip=${skipOldTurnRef.current}`);

      // ── Backend ready ──
      if (msg.type === "ready" || msg.type === "session_ready") {
        // If we reconnected while skipping old turn, clear it now.
        if (skipOldTurnRef.current) {
          console.log("🔄 ready received after reconnect → clear skipOldTurn");
          skipOldTurnRef.current = false;
        }
        continue;
      }

      // ── Skipping old turn after user interrupt ──
      if (skipOldTurnRef.current) {
        if (msg.type === "turn_complete") {
          // Old turn ended: clear skip flag and resume normal processing.
          console.log("⏭️ Old turn_complete skipped, resuming normal processing");
          skipOldTurnRef.current = false;
        }
        continue;
      }

      // ── User transcript ──
      const isUserTranscriptMsg =
        msg.type === "user_transcript" ||
        msg.type === "user_text" ||
        msg.type === "input_transcript" ||
        msg.type === "input_text" ||
        (msg.type === "transcript" && msg.role === "user");
      if (isUserTranscriptMsg) {
        const txt = String(msg.data || msg.text || msg.transcript || msg.input_transcript || "").trim();
        if (!txt) continue;
        pendingUserTextRef.current = mergeTranscript(pendingUserTextRef.current, txt);
        setCurrentUserText(pendingUserTextRef.current);
      }

      // ── AI audio chunk ──
      if ((msg.type === "audio_chunk" || msg.type === "audio") && (msg.data || msg.audio)) {
        const audioData = msg.data || msg.audio || "";
        // While recording, do not play AI audio.
        if (stateRef.current === "recording") continue;

        hasAiOutputThisTurnRef.current = true;
        playChunk(audioData);
        if (stateRef.current !== "ai_speaking") setState("ai_speaking");
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
      }

      // ── AI text/transcript ──
      if (
        (msg.type === "transcript" || msg.type === "text") &&
        msg.role !== "user" &&
        (msg.data || msg.text)
      ) {
        if (stateRef.current === "recording") continue;
        const txt = msg.data || msg.text || "";
        console.log("📝 Transcript received:", txt);
        hasAiOutputThisTurnRef.current = true;
        pendingAITextRef.current = mergeTranscript(pendingAITextRef.current, txt);
        setCurrentAIText(pendingAITextRef.current);
      }

      // ── AI bị interrupted (barge-in) ──
      if (msg.type === "interrupted") {
        if (stateRef.current === "recording") continue;
        // Do not break processing flow due to stale/late interrupted events.
        if (stateRef.current === "processing") {
          console.log("ℹ️ interrupted during processing ignored");
          continue;
        }
        stopPlayback();
        waitingForAudioRef.current = false;
        if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
        setState("ready");
      }

      // ── Turn complete: Gemini xong generate ──
      if (msg.type === "turn_complete") {
        console.log(`✅ turn_complete — state=${stateRef.current} isPlaying=${isPlaying}`);
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }

        // Avoid jumping to ready when Gemini ends turn without output.
        if (!hasAiOutputThisTurnRef.current) {
          console.warn("⚠️ turn_complete with no AI output → keep current state");
          continue;
        }

        const aiText = pendingAITextRef.current;
        const userText = pendingUserTextRef.current;
        pendingAITextRef.current = "";
        pendingUserTextRef.current = "";
        setCurrentAIText("");
        setCurrentUserText("");

        setMessages((prev) => {
          const next = [...prev];
          if (userText) next.push({ role: "user", text: userText, timestamp: new Date() });
          if (aiText) next.push({ role: "assistant", text: aiText, timestamp: new Date() });
          return next;
        });

        // If user is recording, skip state transition.
        if (stateRef.current === "recording") continue;

        waitingForAudioRef.current = true;
        setTimeout(() => {
          if (waitingForAudioRef.current && !isPlaying) {
            if (stateRef.current !== "recording") {
              console.log("✅ turn_complete → ready");
              waitingForAudioRef.current = false;
              hasAiOutputThisTurnRef.current = false;
              setState("ready");
            } else {
              waitingForAudioRef.current = false;
            }
          }
        }, 300);
      }
    }

    lastProcessedIndexRef.current = wsMessages.length - 1;
  }, [wsMessages]); // Depend only on wsMessages, not isPlaying/playChunk/etc.

  useEffect(() => {
    if (messages.length > 0 || currentAIText || currentUserText) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, currentAIText, currentUserText]);

  // ─── Clear timers on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      stopRecording();
      stopAudio();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const updateKeyboardHeight = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height);
      root.style.setProperty("--keyboard-height", showTextInput ? `${keyboardHeight}px` : "0px");
    };

    updateKeyboardHeight();
    window.visualViewport?.addEventListener("resize", updateKeyboardHeight);
    window.visualViewport?.addEventListener("scroll", updateKeyboardHeight);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboardHeight);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardHeight);
      root.style.setProperty("--keyboard-height", "0px");
    };
  }, [showTextInput]);

  const stopAndSendTurn = useCallback((reason: "manual" | "silence" | "no_speech") => {
    if (stateRef.current !== "recording") return;
    console.log(`⏹️ Stop recording → end_of_turn (${reason})`);
    stopRecording();
    if (reason === "no_speech") {
      setState("ready");
      setAutoStopHint("No speech detected clearly. Please try again.");
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 2200);
      return;
    }

    const sent = sendMessage({ type: "end_of_turn" });
    if (!sent) {
      console.warn("⚠️ end_of_turn not sent because websocket is not open");
    } else {
      const museumId = typeof window !== "undefined" ? localStorage.getItem("museum_id") || "demo_museum" : "demo_museum";
      trackEvent("question_asked", museumId, exhibitId, { reason });
    }
    setState("processing");
    hasAiOutputThisTurnRef.current = false;
    if (reason === "silence") {
      setAutoStopHint("Auto-sent because you stopped speaking.");
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 2200);
    }

    // 15s timeout: keep processing state if Gemini has not responded yet.
    processingTimeoutRef.current = setTimeout(() => {
      console.warn("⚠️ 15s timeout while processing (keep processing state)");
    }, 15000);
  }, [stopRecording, sendMessage]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    console.log(`🎤 Start recording — state=${stateRef.current} connected=${isConnected}`);

    if (!isConnected) {
      console.warn("⚠️ Not connected");
      return;
    }

    // Unlock audio explicitly from the voice button click only.
    await unlockAndFlush();

    // From now on, keep using the single ask/stop/processing button flow.
    markIntroUsed();

    // Starting a fresh user turn => clear stale skip flag first.
    skipOldTurnRef.current = false;

    // Stop local audio and skip remaining messages from the old turn.
    stopPlayback();
    waitingForAudioRef.current = false;
    if (currentAIText.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: currentAIText.trim(), timestamp: new Date() },
      ]);
    }
    pendingAITextRef.current = "";
    pendingUserTextRef.current = "";
    setCurrentAIText("");
    setCurrentUserText("");

    if (stateRef.current === "ai_speaking") {
      // AI is speaking: skip all old-turn messages until turn_complete.
      skipOldTurnRef.current = true;
      sendMessage({ type: "interrupt" });
    }

    // Set recording state before awaiting so stateRef can block incoming audio.
    previousStateRef.current = stateRef.current === "paused" ? "paused" : "ready";
    setState("recording");
    const started = sendMessage({ type: "start_of_turn" });
    if (!started) {
      console.warn("⚠️ start_of_turn not sent because websocket is not open");
    }

    await start(
      (base64) => sendMessage({ type: "audio", data: base64 }),
      {
        silenceMs: 1600,
        maxNoSpeechMs: 4500,
        // Keep sending every audio chunk to backend; threshold is only for
        // local silence detection so auto-stop can still trigger.
        voiceThreshold: 0.008,
        onAutoStop: (reason) => {
          console.log(`⏱️ Auto-stop trigger: ${reason}`);
          stopAndSendTurn(reason);
        },
      }
    );
  }, [isConnected, stopPlayback, sendMessage, start, unlockAndFlush, markIntroUsed, stopAndSendTurn, currentAIText]);

  const handleStopRecording = useCallback(() => {
    stopAndSendTurn("manual");
  }, [stopAndSendTurn]);

  const handleBack = useCallback(() => {
    stopRecording();
    stopAudio();
    router.push("/camera-tour");
  }, [stopRecording, stopAudio, router]);

  const handleInterrupt = useCallback(() => {
    stopPlayback();
    waitingForAudioRef.current = false;
    skipOldTurnRef.current = true;
    sendMessage({ type: "interrupt" });
    setState("ready");
  }, [stopPlayback, sendMessage]);

  const handleStop = useCallback(() => {
    stopPlayback();
    waitingForAudioRef.current = false;
    // Stop current AI turn immediately and ignore remaining old-turn chunks.
    skipOldTurnRef.current = true;
    sendMessage({ type: "interrupt" });
    setState("paused");
  }, [stopPlayback, sendMessage]);

  const handleResume = useCallback(() => {
    // Resume from paused mode by requesting continuation.
    skipOldTurnRef.current = false;
    waitingForAudioRef.current = false;
    sendMessage({ type: "resume_greeting" });
    setState("ai_speaking");
  }, [sendMessage]);

  const toggleInputMode = useCallback(() => {
    if (stateRef.current === "ai_speaking") return;
    setInputMode((prev) => {
      const next = prev === "voice" ? "text" : "voice";
      if (next === "text") {
        setShowTextInput(true);
        window.setTimeout(() => textInputRef.current?.focus(), 100);
      } else {
        setShowTextInput(false);
      }
      return next;
    });
  }, []);

  // [FIX 5] Handler duy nhất cho icon ⌨️/🎤 mọi state
  const handleToggleInputMode = useCallback(() => {
    if (stateRef.current === "connecting" || stateRef.current === "processing" || stateRef.current === "recording") {
      return;
    }
    if (stateRef.current === "ai_speaking") {
      stopPlayback();
      waitingForAudioRef.current = false;
      skipOldTurnRef.current = true;
      sendMessage({ type: "interrupt" });
      setState("paused");
      setInputMode("text");
      setShowTextInput(true);
      window.setTimeout(() => textInputRef.current?.focus(), 100);
      return;
    }
    toggleInputMode();
  }, [toggleInputMode, stopPlayback, sendMessage]);

  const handleSendText = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;

    setShowTextInput(false);
    setTextInput("");
    markIntroUsed();
    hasAiOutputThisTurnRef.current = false;
    pendingAITextRef.current = "";
    pendingUserTextRef.current = text;
    setCurrentUserText(text);
    setState("processing");

    const sent = sendTextMessage(text);
    if (!sent) {
      setState(previousStateRef.current);
      return;
    }
    const museumId =
      typeof window !== "undefined" ? localStorage.getItem("museum_id") || "demo_museum" : "demo_museum";
    trackEvent("question_asked", museumId, exhibitId, { reason: "text" });
  }, [textInput, markIntroUsed, sendTextMessage, exhibitId]);

  const handleCancelRecording = useCallback(() => {
    stopRecording();
    hasAiOutputThisTurnRef.current = false;
    setState(previousStateRef.current);
  }, [stopRecording]);

  const handleIntro = useCallback(async () => {
    markIntroUsed();
    await unlockAndFlush();
    sendMessage({ type: "request_greeting" });
    setState("ai_speaking");
  }, [markIntroUsed, unlockAndFlush, sendMessage]);

  const handleMicPress = useCallback(async () => {
    if (showIntroButton && state === "ready") {
      await handleIntro();
      return;
    }
    if (state === "recording") {
      handleStopRecording();
      return;
    }
    if (state === "ai_speaking") {
      handleInterrupt();
      return;
    }
    if (state === "connecting" || state === "processing") {
      return;
    }
    await handleStartRecording();
  }, [showIntroButton, state, handleIntro, handleStopRecording, handleInterrupt, handleStartRecording]);

  // [FIX 4] Ask khi ai_speaking → interrupt + auto-record ngay, không dừng ở ready
  const handleAskPress = useCallback(async () => {
    if (inputMode === "text") {
      if (stateRef.current === "connecting" || stateRef.current === "processing" || stateRef.current === "recording") {
        return;
      }
      if (stateRef.current === "ai_speaking") {
        stopPlayback();
        waitingForAudioRef.current = false;
        skipOldTurnRef.current = true;
        sendMessage({ type: "interrupt" });
        setState("paused");
      }
      setShowTextInput(true);
      window.setTimeout(() => textInputRef.current?.focus(), 100);
      return;
    }
    // inputMode === "voice": Ask = interrupt nếu đang ai_speaking rồi record ngay
    if (stateRef.current === "ai_speaking") {
      // handleStartRecording đã xử lý interrupt + start_of_turn nội bộ
      await handleStartRecording();
      return;
    }
    await handleMicPress();
  }, [inputMode, handleMicPress, handleStartRecording, stopPlayback, sendMessage]);

  const isRecordingState = state === "recording";
  const isSpeakingState = state === "ai_speaking";
  const isProcessingState = state === "processing";
  const isDisabledMic = isSpeakingState || state === "connecting" || isProcessingState;
  const goldBright = "#F6C453";
  const goldLight = "#FFE08A";
  const goldRing = "rgba(246,196,83,0.72)";
  const goldRingSoft = "rgba(255,224,138,0.45)";
  const wsNoticeText =
    wsNotice
      ? WS_NOTICE_I18N[language]?.[wsNotice.reason] ||
        WS_NOTICE_I18N.en[wsNotice.reason] ||
        (language === "vi" ? wsNotice.messageVi : wsNotice.messageEn)
      : "";

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "#0A0A0A",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(201,168,76,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <button
          onClick={handleBack}
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            color: "#F5F0E8",
            fontSize: 18,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ←
        </button>

        <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
          {museumName && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(201,168,76,0.7)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {museumName}
            </div>
          )}
          <div
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: 17,
              fontWeight: 500,
              color: "#F5F0E8",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {exhibitName || "Loading..."}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 20,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {LANGUAGES[language]?.flag || "🌐"}
          </button>

          {showLangMenu && onLanguageChange && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 48,
                background: "rgba(20,20,20,0.98)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                overflow: "hidden",
                zIndex: 50,
              }}
            >
              {Object.entries(LANGUAGES).map(([lang, { flag }]) => (
                <button
                  key={lang}
                  onClick={() => {
                    onLanguageChange(lang as LanguageCode);
                    setShowLangMenu(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: language === lang ? "rgba(201,168,76,0.2)" : "transparent",
                    border: "none",
                    color: "#F5F0E8",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{flag}</span>
                  <span>{lang.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px 16px",
          scrollBehavior: "smooth",
          justifyContent: sentences.length === 0 && !currentAIText && !currentUserText ? "center" : "flex-start",
        }}
      >
        {sentences.length === 0 && !currentAIText && !currentUserText ? (
          <div style={{ textAlign: "center", width: "100%", maxWidth: 420, margin: "0 auto" }}>
            {wsNotice ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "#F5F0E8",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  {wsNoticeText}
                </p>
                {wsNotice.reconnectAllowed && (
                  <button
                    onClick={reconnectNow}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(201,168,76,0.65)",
                      color: "#C9A84C",
                      borderRadius: 10,
                      padding: "6px 14px",
                      fontSize: 13,
                      fontFamily: "DM Sans, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {language === "vi" ? "Kết nối lại" : "Reconnect"}
                  </button>
                )}
              </div>
            ) : (
              <p
                style={{
                  color: "rgba(245,240,232,0.3)",
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "18px",
                  fontStyle: "italic",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                {state === "connecting" ? t(language, "voice.connecting") : t(language, "voice.listening")}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", minWidth: 0 }}>
            {/* Conversation history */}
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  width: "100%",
                  flexShrink: 0,
                  marginBottom: "8px",
                }}
              >
                {/* [FIX 2] Font style đảo ngược: user → DM Sans/normal, AI → Cormorant/italic */}
                <p
                  dir={msg.role === "user" ? "ltr" : undefined}
                  style={{
                  maxWidth: "82%",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  padding: "8px 12px",
                  borderRadius: msg.role === "user"
                    ? "12px 12px 2px 12px"
                    : "12px 12px 12px 2px",
                  background: msg.role === "assistant"
                    ? "rgba(201, 168, 76, 0.15)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: msg.role === "assistant"
                    ? "1px solid rgba(201, 168, 76, 0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: msg.role === "assistant"
                    ? "#C9A84C"
                    : "#F5F0E8",
                  fontFamily: msg.role === "assistant"
                    ? "Cormorant Garamond, serif"
                    : "DM Sans, sans-serif",
                  fontSize: msg.role === "assistant" ? "17px" : "15px",
                  fontStyle: msg.role === "assistant" ? "italic" : "normal",
                  fontWeight: msg.role === "assistant" ? 400 : 400,
                  lineHeight: msg.role === "assistant" ? 1.7 : 1.55,
                  margin: 0,
                  textAlign: "left",
                  direction: "ltr",
                  unicodeBidi: "plaintext",
                }}>
                  {msg.text}
                </p>
              </div>
            ))}
            {/* User đang nói/gõ — turn hiện tại */}
            {/* [FIX 1] justifyContent đồng bộ flex-end, style khớp history user bubble */}
            {currentUserText && (
              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                width: "100%",
                flexShrink: 0,
                marginBottom: "8px",
              }}>
                <p
                  dir="ltr"
                  style={{
                  maxWidth: "82%",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  padding: "8px 12px",
                  borderRadius: "12px 12px 2px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#F5F0E8",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "15px",
                  fontStyle: "normal",
                  fontWeight: 400,
                  lineHeight: 1.55,
                  margin: 0,
                  opacity: 0.85,
                  textAlign: "left",
                  direction: "ltr",
                  unicodeBidi: "plaintext",
                }}>
                  {currentUserText}
                </p>
              </div>
            )}
            {/* AI đang stream — turn hiện tại */}
            {/* [FIX 3] border-radius đúng cho AI (trái), font Cormorant serif italic */}
            {currentAIText && (
              <div style={{
                display: "flex",
                justifyContent: "flex-start",
                width: "100%",
                flexShrink: 0,
                marginBottom: "8px",
              }}>
                <p style={{
                  maxWidth: "82%",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  padding: "8px 12px",
                  borderRadius: "12px 12px 12px 2px",
                  background: "rgba(201, 168, 76, 0.1)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                  color: "#C9A84C",
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "17px",
                  fontStyle: "italic",
                  lineHeight: 1.7,
                  margin: 0,
                  opacity: 0.85,
                }}>
                  {currentAIText}
                </p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg, rgba(10,10,10,0.9) 0%, rgba(10,10,10,1) 30%)",
          borderTop: "1px solid rgba(201,168,76,0.15)",
          padding: "12px 16px calc(16px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 86,
            height: 86,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              position: "absolute",
              width: 84,
              height: 84,
              borderRadius: "50%",
              border: isRecordingState
                ? "1px solid rgba(239,68,68,0.65)"
                : `1px solid ${goldRing}`,
              transform: "scale(1)",
              animation: isRecordingState || isSpeakingState ? "orbPulse 1.6s ease-in-out infinite" : "none",
              opacity: isDisabledMic ? 0.7 : 0.95,
            }}
          />
          <span
            style={{
              position: "absolute",
              width: 74,
              height: 74,
              borderRadius: "50%",
              border: isRecordingState
                ? "1px solid rgba(239,68,68,0.5)"
                : `1px solid ${goldRingSoft}`,
              transform: "scale(1)",
              animation: isRecordingState || isSpeakingState ? "orbPulse 1.6s ease-in-out 0.2s infinite" : "none",
              opacity: isDisabledMic ? 0.55 : 0.85,
            }}
          />
          <button
            onClick={handleMicPress}
            disabled={isDisabledMic}
            title={isDisabledMic ? (state === "connecting" ? "Đang kết nối..." : "Đang xử lý...") : undefined}
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              border: "none",
              cursor: isDisabledMic ? "not-allowed" : "pointer",
              background: isRecordingState
                ? "radial-gradient(circle at 30% 30%, #fb7185, #dc2626 70%)"
                : `radial-gradient(circle at 30% 30%, ${goldLight}, ${goldBright} 72%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              transition: "all 0.2s ease",
              boxShadow: isRecordingState
                ? "0 10px 30px rgba(239,68,68,0.35)"
                : "0 10px 30px rgba(246,196,83,0.45)",
              opacity: isDisabledMic ? 0.5 : 1,
            }}
          >
            {/* [FIX 9] Spinner khi disabled, mic khi active */}
            {isDisabledMic
              ? <span style={{ fontSize: "20px", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
              : isRecordingState ? "" : "🎤"}
          </button>
        </div>

          {isSpeakingState ? (
            <div style={{ width: "100%", maxWidth: "320px", display: "flex", gap: 12 }}>
              <button
                onClick={handleStop}
                style={{
                  flex: 1,
                  height: "56px",
                  background: "transparent",
                  border: "1.5px solid #666",
                  borderRadius: "12px",
                  color: "#F5F0E8",
                  fontSize: "16px",
                  fontWeight: 600,
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                }}
              >
                ⏹ {t(language, "voice.stop")}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <button
                  onClick={handleAskPress}
                  style={{
                    flex: 1,
                    height: "56px",
                    background: "#C9A84C",
                    border: "none",
                    borderRadius: "12px",
                    color: "#0A0A0A",
                    fontSize: "16px",
                    fontWeight: 600,
                    fontFamily: "DM Sans, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {inputMode === "voice" ? `🎙 ${t(language, "voice.ask")}` : `⌨️ ${t(language, "voice.ask")}`}
                </button>
                {/* [FIX 6] Dùng handleToggleInputMode thay handler inline */}
                <button
                  onClick={handleToggleInputMode}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "transparent",
                    border: `1px solid ${inputMode === "text" ? "#C9A84C" : "#444"}`,
                    color: inputMode === "text" ? "#C9A84C" : "#666",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    fontSize: "14px",
                    transition: "all 0.2s",
                  }}
                  aria-label="Switch to text input"
                >
                  ⌨️
                </button>
              </div>
            </div>
          ) : state === "paused" ? (
            // [FIX 7] paused: chỉ Resume + Ask, ẩn toggle mode
            <div style={{ width: "100%", maxWidth: "320px", display: "flex", gap: 12 }}>
              <button
                onClick={handleResume}
                style={{
                  flex: 1,
                  height: "56px",
                  background: "transparent",
                  border: "1.5px solid #666",
                  borderRadius: "12px",
                  color: "#F5F0E8",
                  fontSize: "16px",
                  fontWeight: 600,
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                }}
              >
                ▶ {t(language, "voice.resume")}
              </button>
              <button
                onClick={handleAskPress}
                style={{
                  flex: 1,
                  height: "56px",
                  background: "#C9A84C",
                  border: "none",
                  borderRadius: "12px",
                  color: "#0A0A0A",
                  fontSize: "16px",
                  fontWeight: 600,
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                }}
              >
                {inputMode === "voice" ? `🎙 ${t(language, "voice.ask")}` : `⌨️ ${t(language, "voice.ask")}`}
              </button>
            </div>
          ) : isRecordingState ? (
            <div style={{ width: "100%", maxWidth: "320px", display: "flex", gap: 10 }}>
              <button
                onClick={handleMicPress}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  background: `linear-gradient(135deg, ${goldLight}, ${goldBright})`,
                  color: "#0A0A0A",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "15px",
                  fontWeight: "600",
                  transition: "all 0.2s ease",
                  boxShadow: "0 12px 30px rgba(246,196,83,0.38)",
                }}
              >
                🔴 {t(language, "voice.recording")}
              </button>
              <button
                onClick={handleCancelRecording}
                style={{
                  padding: "14px 12px",
                  borderRadius: "12px",
                  border: "1px solid rgba(245,240,232,0.28)",
                  background: "transparent",
                  color: "#F5F0E8",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✕ {t(language, "voice.cancel")}
              </button>
            </div>
          ) : (
            <div style={{ width: "100%", maxWidth: "320px", display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleAskPress}
                disabled={state === "connecting" || isProcessingState}
                style={{
                  width: "100%",
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: state === "connecting" || isProcessingState ? "not-allowed" : "pointer",
                  background: `linear-gradient(135deg, ${goldLight}, ${goldBright})`,
                  color: "#0A0A0A",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "15px",
                  fontWeight: "600",
                  transition: "all 0.2s ease",
                  opacity: state === "connecting" || isProcessingState ? 0.7 : 1,
                  boxShadow: "0 12px 30px rgba(246,196,83,0.38)",
                }}
              >
                {isProcessingState
                  ? `⏳ ${t(language, "voice.processing")}`
                  : inputMode === "text"
                  ? `⌨️ ${t(language, "voice.ask")}`
                  : showIntroButton && state === "ready"
                  ? `🎵 ${t(language, "voice.listen_guide")}`
                  : `🎙 ${t(language, "voice.ask")}`}
              </button>
              {state === "ready" && !showIntroButton && (
                // [FIX 8] Dùng handleToggleInputMode thống nhất
                <button
                  onClick={handleToggleInputMode}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "transparent",
                    border: `1px solid ${inputMode === "text" ? "#C9A84C" : "#444"}`,
                    color: inputMode === "text" ? "#C9A84C" : "#666",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    fontSize: "14px",
                    transition: "all 0.2s",
                  }}
                  aria-label={inputMode === "voice" ? "Switch to text input" : "Switch to voice input"}
                >
                  {inputMode === "voice" ? "⌨️" : "🎤"}
                </button>
              )}
            </div>
          )}
        {showTextInput && (
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "680px",
              background: "#111",
              borderTop: "1px solid #333",
              padding: "12px 16px",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "8px",
              animation: "slideUp 0.2s ease-out",
              zIndex: 100,
            }}
          >
            <input
              ref={textInputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder={t(language, "voice.type_question")}
              maxLength={500}
              style={{
                flex: 1,
                height: "44px",
                background: "#1a1a1a",
                border: "1px solid #444",
                borderRadius: "22px",
                padding: "0 16px",
                color: "#F5F0E8",
                fontSize: "15px",
                fontFamily: "DM Sans, sans-serif",
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                setShowTextInput(false);
                setTextInput("");
              }}
              style={{
                color: "#666",
                fontSize: "13px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
                padding: "4px 8px",
                flexShrink: 0,
              }}
            >
              {t(language, "voice.cancel")}
            </button>
            <button
              onClick={handleSendText}
              disabled={!textInput.trim()}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: textInput.trim() ? "#C9A84C" : "#333",
                border: "none",
                color: textInput.trim() ? "#0A0A0A" : "#666",
                fontSize: "18px",
                cursor: textInput.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>
        )}
        {autoStopHint && (
          <p
            style={{
              margin: 0,
              marginTop: -2,
              color: "rgba(245,240,232,0.78)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: 12,
              letterSpacing: "0.01em",
            }}
          >
            {autoStopHint}
          </p>
        )}
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
