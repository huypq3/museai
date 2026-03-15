"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useVoiceFSM } from "@/hooks/useVoiceFSM";
import { t } from "@/lib/i18n";
import { BACKEND_URL, LanguageCode } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

type Props = {
  exhibitId: string;
  language: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  museumName?: string;
};

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
  const { stateRef, is, can, dispatch } = useVoiceFSM();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIText, setCurrentAIText] = useState("");
  const [currentUserText, setCurrentUserText] = useState("");
  const [exhibitName, setExhibitName] = useState("");
  const [exhibitNameEn, setExhibitNameEn] = useState("");
  const [exhibitImageUrl, setExhibitImageUrl] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showIntroButton, setShowIntroButton] = useState<boolean>(true);
  const [autoStopHint, setAutoStopHint] = useState("");
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const autoStopHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTextFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs that should not trigger re-renders
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForAudioRef = useRef(false);
  const pendingAITextRef = useRef("");
  const pendingUserTextRef = useRef("");
  const currentAITextRef = useRef("");
  const hasAiOutputThisTurnRef = useRef(false);
  const pendingIntroAfterConnectRef = useRef(false);
  const introInFlightRef = useRef(false);
  const awaitingOldTurnCompleteRef = useRef(false);
  const micPermissionPrimedRef = useRef(false);
  const introMicAnchorStreamRef = useRef<MediaStream | null>(null);
  const runtimeLanguageRef = useRef<LanguageCode>(language);
  const vadInterruptLockRef = useRef(false);
  const lastWaveTapAtRef = useRef(0);
  const waveTapSeqRef = useRef(0);
  const autoStartLockRef = useRef(false);
  const lastAutoStartAtRef = useRef(0);
  const lastAiAudioAtRef = useRef(0);
  const showIntroButtonRef = useRef(true);
  const stickToBottomRef = useRef(true);

  const {
    start,
    stop: stopRecording,
    destroy: destroyRecorder,
    startVADMonitor,
    stopVADMonitor,
  } = useAudioRecorder();
  const { playChunk, stopPlayback, stop: stopAudio, isPlaying, unlockAndFlush, getContext: getAudioContext } = useAudioPlayer();
  const releaseIntroMicAnchor = useCallback(() => {
    if (!introMicAnchorStreamRef.current) return;
    introMicAnchorStreamRef.current.getTracks().forEach((track) => track.stop());
    introMicAnchorStreamRef.current = null;
  }, []);
  const scheduleAITextFlush = useCallback(() => {
    if (aiTextFlushTimerRef.current) return;
    aiTextFlushTimerRef.current = setTimeout(() => {
      setCurrentAIText(pendingAITextRef.current);
      aiTextFlushTimerRef.current = null;
    }, 100);
  }, []);
  const handleAudioChunk = useCallback((base64: string) => {
    if (!base64 || stateRef.current === "recording") return;
    lastAiAudioAtRef.current = Date.now();
    hasAiOutputThisTurnRef.current = true;
    waitingForAudioRef.current = true;
    if (stateRef.current === "processing" && can("FIRST_AI_CHUNK")) {
      dispatch({ type: "FIRST_AI_CHUNK" });
    }
    playChunk(base64);
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, [can, dispatch, playChunk, stateRef]);

  const handleControlMessage = useCallback((msg: any) => {
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "ready" || msg.type === "session_ready") return;
    if (msg.type === "language_switched") {
      const toLang = String(msg.to || "").toLowerCase() as LanguageCode;
      if (toLang && LANGUAGES[toLang]) {
        runtimeLanguageRef.current = toLang;
        onLanguageChange?.(toLang);
      }
      return;
    }
    if (msg.type === "session_end") {
      releaseIntroMicAnchor();
      if (can("SESSION_ENDED")) dispatch({ type: "SESSION_ENDED" });
      return;
    }

    // turn_complete from old interrupted turn: ignore it, we already resolved draining
    if (awaitingOldTurnCompleteRef.current && msg.type === "turn_complete") {
      awaitingOldTurnCompleteRef.current = false;
      return;
    }

    const isUserTranscriptMsg =
      msg.type === "user_transcript" ||
      msg.type === "user_text" ||
      msg.type === "input_transcript" ||
      msg.type === "input_text" ||
      (msg.type === "transcript" && msg.role === "user");
    if (isUserTranscriptMsg) {
      const txt = String(msg.data || msg.text || msg.transcript || msg.input_transcript || "").trim();
      if (!txt) return;
      pendingUserTextRef.current = mergeTranscript(pendingUserTextRef.current, txt);
      setCurrentUserText(pendingUserTextRef.current);
      return;
    }

    if (msg.type === "audio" && (msg.data || msg.audio)) {
      const audioData = String(msg.data || msg.audio || "");
      handleAudioChunk(audioData);
      return;
    }

    if (
      (msg.type === "transcript" || msg.type === "text") &&
      msg.role !== "user" &&
      (msg.data || msg.text)
    ) {
      if (stateRef.current === "recording") return;
      const txt = String(msg.data || msg.text || "").trim();
      if (!txt) return;
      if (stateRef.current === "processing" && can("FIRST_AI_CHUNK")) {
        dispatch({ type: "FIRST_AI_CHUNK" });
      }
      hasAiOutputThisTurnRef.current = true;
      pendingAITextRef.current = mergeTranscript(pendingAITextRef.current, txt);
      scheduleAITextFlush();
      return;
    }

    if (msg.type === "interrupted") {
      stopPlayback(); // always flush immediately regardless of FSM state
      waitingForAudioRef.current = false;
      return;
    }

    if (msg.type === "turn_complete") {
      releaseIntroMicAnchor();
      if (aiTextFlushTimerRef.current) {
        clearTimeout(aiTextFlushTimerRef.current);
        aiTextFlushTimerRef.current = null;
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }

      const aiText = pendingAITextRef.current.trim();
      const userText = pendingUserTextRef.current.trim();

      if (userText) {
        setMessages((prev) => [...prev, { role: "user", text: userText, timestamp: new Date() }]);
      }
      if (aiText) {
        setMessages((prev) => [...prev, { role: "assistant", text: aiText, timestamp: new Date() }]);
      }

      pendingAITextRef.current = "";
      pendingUserTextRef.current = "";
      setCurrentAIText("");
      setCurrentUserText("");
      waitingForAudioRef.current = false;

      if (!hasAiOutputThisTurnRef.current) {
        if (can("TURN_COMPLETE_EMPTY")) dispatch({ type: "TURN_COMPLETE_EMPTY" });
      } else if (can("TURN_COMPLETE")) {
        dispatch({ type: "TURN_COMPLETE" });
      }
      hasAiOutputThisTurnRef.current = false;
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [can, dispatch, stateRef, onLanguageChange, handleAudioChunk, stopPlayback, scheduleAITextFlush, releaseIntroMicAnchor]);

  const {
    isConnected,
    notice: wsNotice,
    sendMessage,
    reconnectNow,
    connect,
  } = useWebSocket(exhibitId, language, {
    onAudioChunk: handleAudioChunk,
    onControlMessage: handleControlMessage,
    autoConnect: false,
  });
  const sentences = messages;

  const markIntroUsed = useCallback(() => {
    showIntroButtonRef.current = false;
    setShowIntroButton(false);
  }, []);

  // ─── Load exhibit name ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/exhibits/${exhibitId}`)
      .then((r) => r.json())
      .then((data) => {
        const exhibit = data.data || {};
        const displayName =
          language === "en"
            ? exhibit.name_en || exhibit.name || ""
            : exhibit.name || exhibit.name_en || "";
        setExhibitName(displayName);
        setExhibitNameEn(exhibit.name_en || exhibit.name || "");
        const representativeImage =
          exhibit.primary_image_url ||
          exhibit.image_url ||
          (Array.isArray(exhibit.gallery_images) ? exhibit.gallery_images[0] : "") ||
          "";
        setExhibitImageUrl(String(representativeImage || ""));
      })
      .catch((e) => console.error("Failed to load exhibit:", e));
  }, [exhibitId, language]);

  useEffect(() => {
    showIntroButtonRef.current = true;
    setShowIntroButton(true);
  }, [exhibitId]);

  useEffect(() => {
    runtimeLanguageRef.current = language;
  }, [language]);

  useEffect(() => {
    showIntroButtonRef.current = showIntroButton;
  }, [showIntroButton]);

  useEffect(() => {
    currentAITextRef.current = currentAIText;
  }, [currentAIText]);

  const handleTranscriptScroll = useCallback(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceToBottom <= 72;
  }, []);

  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    if (stickToBottomRef.current || is.aiSpeaking || is.processing) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, currentAIText, currentUserText, is.aiSpeaking, is.processing]);

  // ─── Sync websocket connectivity → FSM ────────────────────────────────
  useEffect(() => {
    if (isConnected) {
      if (can("WS_CONNECTED")) dispatch({ type: "WS_CONNECTED" });
      return;
    }
    // Avoid immediate connecting -> reconnecting flip before user initiates connect.
    if (stateRef.current === "connecting" && !pendingIntroAfterConnectRef.current) return;
    // Keep processing UI while waiting for turn_complete fallback.
    if (stateRef.current === "processing") return;
    if (can("WS_DISCONNECTED")) dispatch({ type: "WS_DISCONNECTED" });
  }, [isConnected, can, dispatch, stateRef]);

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
      if (can("TURN_COMPLETE")) dispatch({ type: "TURN_COMPLETE" });
    }
  }, [isPlaying, can, dispatch, stateRef]);

  useEffect(() => {
    if (!is.draining) return;
    const t = setTimeout(() => {
      if (stateRef.current === "draining" && can("DRAINING_TIMEOUT")) {
        dispatch({ type: "DRAINING_TIMEOUT" });
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [is.draining, can, dispatch, stateRef]);

  // ─── Clear timers on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      if (aiTextFlushTimerRef.current) clearTimeout(aiTextFlushTimerRef.current);
      releaseIntroMicAnchor();
      void stopVADMonitor();
      destroyRecorder();
      stopAudio();
    };
  }, [destroyRecorder, stopAudio, releaseIntroMicAnchor, stopVADMonitor]);

  const stopAndSendTurn = useCallback((reason: "manual" | "silence" | "no_speech") => {
    if (stateRef.current !== "recording") return;
    console.log(`⏹️ Stop recording → end_of_turn (${reason})`);
    stopRecording();
    if (reason === "no_speech") {
      if (can("NO_SPEECH")) dispatch({ type: "NO_SPEECH" });
      setAutoStopHint("No speech detected clearly. Please try again.");
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 2200);
      return;
    }

    sendMessage({ type: "end_of_turn" });
    const museumId = typeof window !== "undefined" ? localStorage.getItem("museum_id") || "demo_museum" : "demo_museum";
    trackEvent("question_asked", museumId, exhibitId, { reason });

    if (can("END_OF_TURN")) dispatch({ type: "END_OF_TURN" });
    hasAiOutputThisTurnRef.current = false;

    if (reason === "silence") {
      setAutoStopHint("");
    }

    // 15s timeout: nếu không có phản hồi → force về ready tránh bị kẹt
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    processingTimeoutRef.current = setTimeout(() => {
      if (stateRef.current === "processing") {
        console.warn("⚠️ 15s timeout → force ready");
        hasAiOutputThisTurnRef.current = false;
        if (can("PROCESSING_TIMEOUT")) dispatch({ type: "PROCESSING_TIMEOUT" });
      }
    }, 15000);
  }, [stopRecording, sendMessage, exhibitId, can, dispatch, stateRef]);

  const startVoiceCapture = useCallback(async (): Promise<boolean> => {
    await unlockAndFlush();
    sendMessage({ type: "set_language", language: runtimeLanguageRef.current });
    const started = sendMessage({ type: "start_of_turn" });
    if (!started) {
      console.warn("⚠️ start_of_turn not sent because websocket is not open");
      return false;
    }
    const ctx = getAudioContext();
    if (!ctx) {
      console.warn("⚠️ AudioContext is not ready; unlockAndFlush must run before startVoiceCapture");
      return false;
    }
    await start(
      ctx,
      (base64) => sendMessage({ type: "audio", data: base64 }),
      {
        silenceMs: 600,
        maxNoSpeechMs: 4500,
        voiceThreshold: 0.005,
        onAutoStop: (reason) => {
          console.log(`⏱️ Auto-stop trigger: ${reason}`);
          stopAndSendTurn(reason);
        },
      }
    );
    micPermissionPrimedRef.current = true;
    return true;
  }, [sendMessage, start, stopAndSendTurn, getAudioContext, unlockAndFlush]);

  const handleBack = useCallback(() => {
    stopRecording();
    stopAudio();
    router.push("/camera-tour");
  }, [stopRecording, stopAudio, router]);

  const handleInterrupt = useCallback(async () => {
    if (!can("INTERRUPT")) return;
    sendMessage({ type: "interrupt" });
    stopPlayback();
    waitingForAudioRef.current = false;
    dispatch({ type: "INTERRUPT", drainingIntent: "ask_voice" });
    dispatch({ type: "INTERRUPT_DONE" });

    if (currentAITextRef.current.trim()) {
      setMessages((prev) => [...prev, { role: "assistant", text: currentAITextRef.current.trim(), timestamp: new Date() }]);
      pendingAITextRef.current = "";
      setCurrentAIText("");
    }
    pendingUserTextRef.current = "";
    setCurrentUserText("");

    const ok = await startVoiceCapture();
    if (!ok && can("CANCEL_RECORDING")) {
      dispatch({ type: "CANCEL_RECORDING" });
    }
  }, [can, stopPlayback, sendMessage, dispatch, startVoiceCapture]);

  useEffect(() => {
    let cancelled = false;

    const currentState =
      is.aiSpeaking ? "ai_speaking" :
      is.ready ? "ready" :
      is.paused ? "paused" :
      stateRef.current;
    const shouldMonitor =
      isConnected &&
      !is.recording &&
      (currentState === "ai_speaking" || currentState === "ready" || currentState === "paused");

    if (!shouldMonitor) {
      void stopVADMonitor();
      return () => {
        cancelled = true;
      };
    }
    console.log(`🧪 VAD monitor start: state=${currentState}`);

    void startVADMonitor(
      () => {
        if (cancelled) return;
        if (vadInterruptLockRef.current) return;
        console.log(`🧪 VAD trigger: state=${stateRef.current}`);
        vadInterruptLockRef.current = true;

        const s = stateRef.current;
        if (s === "ai_speaking") {
          void handleInterrupt();
        } else if ((s === "ready" || s === "paused") && can("ASK_VOICE")) {
          if (showIntroButtonRef.current) {
            // Intro not yet played — don't auto-start recording via VAD
            vadInterruptLockRef.current = false;
            return;
          }
          const now = Date.now();
          const recentlyPlayedAi = now - lastAiAudioAtRef.current < 700;
          const inTurnCooldown = now - lastAutoStartAtRef.current < 1600;
          if (recentlyPlayedAi || inTurnCooldown || autoStartLockRef.current) {
            vadInterruptLockRef.current = false;
            return;
          }
          autoStartLockRef.current = true;
          lastAutoStartAtRef.current = now;
          void (async () => {
            dispatch({ type: "ASK_VOICE" });
            const ok = await startVoiceCapture();
            if (!ok && can("CANCEL_RECORDING")) {
              dispatch({ type: "CANCEL_RECORDING" });
            }
            autoStartLockRef.current = false;
          })();
        }

        window.setTimeout(() => {
          vadInterruptLockRef.current = false;
        }, 900);
      },
      {
        threshold: 0.012,
        minSpeechFrames: 3,
        minSpeechMs: 220,
        cooldownMs: 1200,
      }
    );

    return () => {
      cancelled = true;
      console.log("🧪 VAD monitor stop");
      void stopVADMonitor();
    };
  }, [isConnected, is.recording, is.aiSpeaking, is.ready, is.paused, handleInterrupt, startVADMonitor, stopVADMonitor, stateRef, can, dispatch, startVoiceCapture]);

  const handleIntro = useCallback(async () => {
    if (introInFlightRef.current) return;
    introInFlightRef.current = true;
    try {
      console.log(`🎬 intro-start, state=${stateRef.current}`);
      await unlockAndFlush();
      if (!micPermissionPrimedRef.current) {
        try {
          console.log("🎤 intro requesting mic permission...");
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          introMicAnchorStreamRef.current = stream;
          micPermissionPrimedRef.current = true;
          console.log("✅ intro mic permission granted");
        } catch (e) {
          console.warn("⚠️ Mic permission preflight failed before greeting:", e);
        }
      }
      await unlockAndFlush();
      const sent = sendMessage({ type: "request_greeting" });
      if (!sent) {
        console.warn("⚠️ request_greeting failed — WS not open");
        pendingIntroAfterConnectRef.current = true;
        reconnectNow();
        return;
      }
      pendingIntroAfterConnectRef.current = false;
      markIntroUsed();
      // Release temporary intro anchor so VAD can immediately re-open mic stream.
      releaseIntroMicAnchor();
      dispatch({ type: "GREETING_REQUESTED" });
      console.log("✅ intro request_greeting sent");
    } finally {
      introInFlightRef.current = false;
    }
  }, [markIntroUsed, unlockAndFlush, sendMessage, dispatch, stateRef, reconnectNow, releaseIntroMicAnchor]);

  useEffect(() => {
    if (!isConnected) return;
    if (!pendingIntroAfterConnectRef.current) return;
    if (!showIntroButton) return;
    pendingIntroAfterConnectRef.current = false;
    void handleIntro();
  }, [isConnected, showIntroButton, handleIntro]);

  const handleMicPress = useCallback(async () => {
    const currentState = stateRef.current;
    const introMode = showIntroButtonRef.current;
    console.log(
      `🎛️ waveform tap: state=${currentState} ready=${is.ready} connected=${isConnected} showIntro=${introMode}`
    );
    if (!introMode) {
      // Post-intro: button acts as manual interrupt or mic trigger
      if (currentState === "ai_speaking" && can("INTERRUPT")) {
        void handleInterrupt();
      } else if ((currentState === "ready" || currentState === "paused") && can("ASK_VOICE")) {
        await unlockAndFlush();
        dispatch({ type: "ASK_VOICE" });
        const ok = await startVoiceCapture();
        if (!ok && can("CANCEL_RECORDING")) dispatch({ type: "CANCEL_RECORDING" });
      }
      return;
    }

    pendingIntroAfterConnectRef.current = true;
    // Start WS immediately on first tap; do not wait for permission prompt resolution.
    if (!isConnected) {
      void connect();
    }

    // Always unlock AudioContext in a user gesture.
    await unlockAndFlush();

    if (!micPermissionPrimedRef.current) {
      try {
        console.log("🎤 Mic preflight start (tap)");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        introMicAnchorStreamRef.current = stream;
        micPermissionPrimedRef.current = true;
        console.log("✅ Mic preflight granted (tap)");
      } catch (e) {
        console.warn("⚠️ Mic preflight failed:", e);
      }
    }

    if (isConnected && is.ready) {
      await handleIntro();
      return;
    }

    setAutoStopHint(language === "vi" ? "Đang kết nối..." : "Connecting...");
    if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
    autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 3000);
    console.log(`⏳ intro queued: connected=${isConnected} ready=${is.ready} state=${stateRef.current}`);
    if (!isConnected) void connect();
  }, [isConnected, is.ready, handleIntro, stateRef, connect, unlockAndFlush, language, can, handleInterrupt, dispatch, startVoiceCapture]);

  const handleWaveTap = useCallback(() => {
    const tapId = ++waveTapSeqRef.current;
    const ts = new Date().toISOString();
    console.log(`🧭 wave_tap id=${tapId} ts=${ts}`);
    const now = Date.now();
    if (now - lastWaveTapAtRef.current < 250) {
      console.log(`🧭 wave_tap id=${tapId} ignored=debounce`);
      return;
    }
    lastWaveTapAtRef.current = now;
    console.log(`🧭 wave_tap id=${tapId} dispatch=handleMicPress`);
    void handleMicPress();
  }, [handleMicPress]);

  const isRecordingState = is.recording;
  const isSpeakingState = is.aiSpeaking;
  const isProcessingState = is.processing;
  const isDisabledWave =
    is.error || is.sessionEnded || is.processing || is.draining ||
    (!showIntroButton && (is.connecting || is.reconnecting));
  // Pre-intro should stay tappable/clear; spinner is for active/transient states after intro.
  const showButtonSpinner =
    is.processing || is.draining || (!showIntroButton && (is.connecting || is.reconnecting));
  const isWaveStartEnabled = !is.error && !is.sessionEnded && !showButtonSpinner;
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
        minHeight: "100dvh",
        width: "100vw",
        maxWidth: "100vw",
        overflow: "hidden",
        overflowX: "hidden",
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
        ref={transcriptContainerRef}
        onScroll={handleTranscriptScroll}
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
          <div style={{ textAlign: "center", width: "100%", maxWidth: 420, margin: "0 auto", height: "100%" }}>
            {exhibitImageUrl && (
              <div
                style={{
                  marginBottom: 12,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid rgba(201,168,76,0.22)",
                  background: "rgba(255,255,255,0.02)",
                  height: "40%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={exhibitImageUrl}
                  alt={exhibitName || "Exhibit image"}
                  style={{
                    display: "block",
                    width: "70%",
                    height: "auto",
                    maxHeight: "100%",
                    objectFit: "contain",
                  }}
                  onError={() => setExhibitImageUrl("")}
                />
              </div>
            )}
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
                {exhibitImageUrl
                  ? (exhibitNameEn || exhibitName || t(language, "voice.listening"))
                  : (is.connecting || is.reconnecting ? t(language, "voice.connecting") : t(language, "voice.listening"))}
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
                <p
                  dir="ltr"
                  style={{
                    maxWidth: "82%",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    padding: "8px 12px",
                    borderRadius: msg.role === "user"
                      ? "12px 12px 2px 12px"
                      : "12px 12px 12px 2px",
                    background: msg.role === "user"
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(201, 168, 76, 0.15)",
                    border: msg.role === "user"
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid rgba(201, 168, 76, 0.3)",
                    color: msg.role === "user"
                      ? "#F5F0E8"
                      : "#C9A84C",
                    fontFamily: msg.role === "user"
                      ? "DM Sans, sans-serif"
                      : "Cormorant Garamond, serif",
                    fontSize: msg.role === "user" ? "15px" : "17px",
                    fontStyle: msg.role === "user" ? "normal" : "italic",
                    fontWeight: 400,
                    lineHeight: msg.role === "user" ? 1.55 : 1.7,
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
              opacity: isDisabledWave ? 0.7 : 0.95,
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
              opacity: isDisabledWave ? 0.55 : 0.85,
            }}
          />
          <button
            onClick={handleWaveTap}
            title={isDisabledWave ? (is.connecting || is.reconnecting ? "Đang kết nối..." : "Đang xử lý...") : undefined}
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              pointerEvents: "auto",
              position: "relative",
              zIndex: 20,
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
              opacity: isWaveStartEnabled ? 1 : 0.6,
            }}
          >
            {showButtonSpinner
              ? <span style={{ fontSize: "20px", animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
              : isRecordingState ? "" : "🎤"}
          </button>
        </div>

        <p
          style={{
            margin: 0,
            color: "rgba(245,240,232,0.8)",
            fontFamily: "DM Sans, sans-serif",
            fontSize: 13,
            letterSpacing: "0.02em",
          }}
        >
          {is.draining
            ? (language === "vi" ? "Đang chuyển sang lượt mới..." : "Switching to new turn...")
            : isRecordingState
              ? t(language, "voice.recording")
              : isSpeakingState
                ? t(language, "voice.speaking")
                  : isProcessingState
                    ? t(language, "voice.processing")
                  : showIntroButton
                    ? t(language, "voice.listen_guide")
                    : t(language, "voice.speak_to_ask")}
        </p>
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
