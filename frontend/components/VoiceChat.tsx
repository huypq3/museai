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
  const hasAiOutputThisTurnRef = useRef(false);
  const pendingAskVoiceAfterDrainRef = useRef(false);
  const runtimeLanguageRef = useRef<LanguageCode>(language);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const {
    isConnected,
    messages: wsMessages,
    notice: wsNotice,
    sendMessage,
    sendTextMessage,
    reconnectNow,
  } = useWebSocket(exhibitId, language);
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

  useEffect(() => {
    runtimeLanguageRef.current = language;
  }, [language]);

  // ─── Sync websocket connectivity → FSM ────────────────────────────────
  useEffect(() => {
    if (isConnected) {
      if (can("WS_CONNECTED")) dispatch({ type: "WS_CONNECTED" });
      return;
    }
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

  // ─── Process WS messages with FSM ──────────────────────────────────────
  useEffect(() => {
    if (wsMessages.length === 0) return;

    const startIndex = lastProcessedIndexRef.current + 1;
    if (startIndex >= wsMessages.length) return;

    for (let i = startIndex; i < wsMessages.length; i++) {
      const msg = wsMessages[i];

      if (msg.type === "ready" || msg.type === "session_ready") continue;
      if (msg.type === "language_switched") {
        const toLang = String(msg.to || "").toLowerCase() as LanguageCode;
        if (toLang && LANGUAGES[toLang]) {
          runtimeLanguageRef.current = toLang;
          onLanguageChange?.(toLang);
        }
        continue;
      }
      if (msg.type === "session_end") {
        if (can("SESSION_ENDED")) dispatch({ type: "SESSION_ENDED" });
        continue;
      }

      if (is.draining) {
        if (msg.type === "turn_complete") {
          if (can("TURN_COMPLETE")) dispatch({ type: "TURN_COMPLETE" });
        }
        continue;
      }

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

      if ((msg.type === "audio_chunk" || msg.type === "audio") && (msg.data || msg.audio)) {
        const audioData = msg.data || msg.audio || "";
        if (stateRef.current === "recording") continue;

        hasAiOutputThisTurnRef.current = true;
        waitingForAudioRef.current = true;
        if (stateRef.current === "processing" && can("FIRST_AI_CHUNK")) {
          dispatch({ type: "FIRST_AI_CHUNK" });
        }
        playChunk(audioData);
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
      }

      if (
        (msg.type === "transcript" || msg.type === "text") &&
        msg.role !== "user" &&
        (msg.data || msg.text)
      ) {
        if (stateRef.current === "recording") continue;
        const txt = String(msg.data || msg.text || "").trim();
        if (!txt) continue;
        if (stateRef.current === "processing" && can("FIRST_AI_CHUNK")) {
          dispatch({ type: "FIRST_AI_CHUNK" });
        }
        hasAiOutputThisTurnRef.current = true;
        pendingAITextRef.current = mergeTranscript(pendingAITextRef.current, txt);
        setCurrentAIText(pendingAITextRef.current);
      }

      if (msg.type === "interrupted") {
        if (stateRef.current === "processing" || stateRef.current === "recording") continue;
        stopPlayback();
        waitingForAudioRef.current = false;
      }

      if (msg.type === "turn_complete") {
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
      }
    }

    lastProcessedIndexRef.current = wsMessages.length - 1;
  }, [wsMessages, is.draining, can, dispatch, stateRef, playChunk, stopPlayback, onLanguageChange]);

  useEffect(() => {
    if (!is.draining) return;
    const t = setTimeout(() => {
      if (stateRef.current === "draining" && can("DRAINING_TIMEOUT")) {
        dispatch({ type: "DRAINING_TIMEOUT" });
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [is.draining, can, dispatch, stateRef]);

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
  }, [stopRecording, stopAudio]);

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
      setAutoStopHint("Auto-sent because you stopped speaking.");
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 2200);
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

  const startVoiceCapture = useCallback(async () => {
    sendMessage({ type: "set_language", language: runtimeLanguageRef.current });
    const started = sendMessage({ type: "start_of_turn" });
    if (!started) {
      console.warn("⚠️ start_of_turn not sent because websocket is not open");
      return;
    }
    await start(
      (base64) => sendMessage({ type: "audio", data: base64 }),
      {
        silenceMs: 1600,
        maxNoSpeechMs: 4500,
        voiceThreshold: 0.008,
        onAutoStop: (reason) => {
          console.log(`⏱️ Auto-stop trigger: ${reason}`);
          stopAndSendTurn(reason);
        },
      }
    );
  }, [sendMessage, start, stopAndSendTurn]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    console.log(`🎤 Start recording — state=${stateRef.current} connected=${isConnected}`);

    if (!isConnected) {
      console.warn("⚠️ Not connected");
      return;
    }
    if (!can("ASK_VOICE")) return;

    // Unlock audio explicitly from the voice button click only.
    await unlockAndFlush();

    // From now on, keep using the single ask/stop/processing button flow.
    markIntroUsed();

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

    if (stateRef.current === "ai_speaking" && can("INTERRUPT")) {
      sendMessage({ type: "interrupt" });
      dispatch({ type: "INTERRUPT", drainingIntent: "ask_voice" });
    }

    pendingAskVoiceAfterDrainRef.current = false;
    if (can("ASK_VOICE")) dispatch({ type: "ASK_VOICE" });
    await startVoiceCapture();
  }, [
    isConnected,
    can,
    dispatch,
    sendMessage,
    stopPlayback,
    unlockAndFlush,
    markIntroUsed,
    startVoiceCapture,
    currentAIText,
    stateRef,
  ]);

  const handleStopRecording = useCallback(() => {
    stopAndSendTurn("manual");
  }, [stopAndSendTurn]);

  const handleBack = useCallback(() => {
    stopRecording();
    stopAudio();
    router.push("/camera-tour");
  }, [stopRecording, stopAudio, router]);

  const handleInterrupt = useCallback(async () => {
    if (!can("INTERRUPT")) return;
    stopPlayback();
    waitingForAudioRef.current = false;
    pendingAskVoiceAfterDrainRef.current = true;
    sendMessage({ type: "interrupt" });
    dispatch({ type: "INTERRUPT", drainingIntent: "ask_voice" });

    if (currentAIText.trim()) {
      setMessages((prev) => [...prev, { role: "assistant", text: currentAIText.trim(), timestamp: new Date() }]);
      pendingAITextRef.current = "";
      setCurrentAIText("");
    }
    pendingUserTextRef.current = "";
    setCurrentUserText("");

  }, [can, stopPlayback, sendMessage, dispatch, currentAIText]);

  const handleStop = useCallback(() => {
    if (!can("STOP_PRESSED")) return;
    pendingAskVoiceAfterDrainRef.current = false;
    stopPlayback();
    waitingForAudioRef.current = false;
    sendMessage({ type: "interrupt" });
    dispatch({ type: "STOP_PRESSED", drainingIntent: "stop" });
  }, [can, stopPlayback, sendMessage, dispatch]);

  const handleResume = useCallback(() => {
    if (!can("RESUME_PRESSED")) return;
    waitingForAudioRef.current = false;
    dispatch({ type: "RESUME_PRESSED" });
    sendMessage({ type: "resume_greeting" });
  }, [can, dispatch, sendMessage]);

  // Chuyển sang TEXT — mọi state
  const switchToText = useCallback(() => {
    pendingAskVoiceAfterDrainRef.current = false;
    if (is.inputBlocked || stateRef.current === "recording") return;
    if (!can("ASK_TEXT")) return;
    if (stateRef.current === "ai_speaking" && can("STOP_PRESSED")) {
      stopPlayback();
      waitingForAudioRef.current = false;
      sendMessage({ type: "interrupt" });
      dispatch({ type: "STOP_PRESSED", drainingIntent: "ask_text" });
    } else {
      dispatch({ type: "ASK_TEXT" });
    }
    setInputMode("text");
    setShowTextInput(true);
    window.setTimeout(() => textInputRef.current?.focus(), 100);
  }, [is.inputBlocked, can, stateRef, stopPlayback, sendMessage, dispatch]);

  // Chuyển sang VOICE — đóng textbox, bắt đầu record ngay
  const switchToVoice = useCallback(async () => {
    setShowTextInput(false);
    setTextInput("");
    setInputMode("voice");
    if (is.inputBlocked || stateRef.current === "recording") return;
    await handleStartRecording();
  }, [is.inputBlocked, stateRef, handleStartRecording]);

  const handleSendText = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;

    // blur trước để iOS dismiss keyboard trước khi body unlock
    textInputRef.current?.blur();
    setShowTextInput(false);
    setTextInput("");
    setInputMode("voice");
    markIntroUsed();

    // Lưu transcript AI đang hiển thị vào messages TRƯỚC khi xoá
    // (tránh mất transcript thuyết minh trước đó)
    const existingAIText = pendingAITextRef.current;
    const existingUserText = pendingUserTextRef.current;
    if (existingAIText || existingUserText) {
      setMessages((prev) => {
        const next = [...prev];
        if (existingUserText) next.push({ role: "user", text: existingUserText, timestamp: new Date() });
        if (existingAIText) next.push({ role: "assistant", text: existingAIText, timestamp: new Date() });
        return next;
      });
    }

    hasAiOutputThisTurnRef.current = false;
    pendingAITextRef.current = "";
    pendingUserTextRef.current = text;
    setCurrentAIText("");
    setCurrentUserText(text);
    if (can("TEXT_SENT")) dispatch({ type: "TEXT_SENT" });
    sendMessage({ type: "set_language", language: runtimeLanguageRef.current });

    const sent = sendTextMessage(text);
    if (!sent) {
      if (can("PROCESSING_TIMEOUT")) dispatch({ type: "PROCESSING_TIMEOUT" });
      return;
    }
    const museumId =
      typeof window !== "undefined" ? localStorage.getItem("museum_id") || "demo_museum" : "demo_museum";
    trackEvent("question_asked", museumId, exhibitId, { reason: "text" });
  }, [textInput, markIntroUsed, sendTextMessage, sendMessage, exhibitId, can, dispatch]);

  const handleCancelRecording = useCallback(() => {
    pendingAskVoiceAfterDrainRef.current = false;
    stopRecording();
    hasAiOutputThisTurnRef.current = false;
    if (can("CANCEL_RECORDING")) dispatch({ type: "CANCEL_RECORDING" });
  }, [stopRecording, can, dispatch]);

  const handleIntro = useCallback(async () => {
    if (!can("GREETING_REQUESTED")) return;
    markIntroUsed();
    await unlockAndFlush();
    sendMessage({ type: "request_greeting" });
    dispatch({ type: "GREETING_REQUESTED" });
  }, [can, markIntroUsed, unlockAndFlush, sendMessage, dispatch]);

  const handleMicPress = useCallback(async () => {
    if (showIntroButton && is.ready) {
      await handleIntro();
      return;
    }
    if (is.recording) {
      handleStopRecording();
      return;
    }
    if (is.aiSpeaking) {
      handleInterrupt();
      return;
    }
    if (is.inputBlocked) {
      return;
    }
    await handleStartRecording();
  }, [showIntroButton, is.ready, is.recording, is.aiSpeaking, is.inputBlocked, handleIntro, handleStopRecording, handleInterrupt, handleStartRecording]);

  const handleAskPress = useCallback(async () => {
    if (inputMode === "text") {
      if (is.inputBlocked || stateRef.current === "recording") return;
      if (!can("ASK_TEXT")) return;
      dispatch({ type: "ASK_TEXT" });
      setShowTextInput(true);
      window.setTimeout(() => textInputRef.current?.focus(), 100);
      return;
    }
    await handleMicPress();
  }, [inputMode, is.inputBlocked, stateRef, can, dispatch, handleMicPress]);

  useEffect(() => {
    if (!is.recording) return;
    if (!pendingAskVoiceAfterDrainRef.current) return;
    pendingAskVoiceAfterDrainRef.current = false;
    void startVoiceCapture();
  }, [is.recording, startVoiceCapture]);

  const isRecordingState = is.recording;
  const isSpeakingState = is.aiSpeaking;
  const isProcessingState = is.processing;
  const isDisabledMic = is.aiSpeaking || is.connecting || is.processing || is.draining;
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
                {is.connecting || is.reconnecting ? t(language, "voice.connecting") : t(language, "voice.listening")}
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
            title={isDisabledMic ? (is.connecting || is.reconnecting ? "Đang kết nối..." : "Đang xử lý...") : undefined}
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
          <div style={{ width: "100%", maxWidth: "360px", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Stop — flex:1 */}
            <button
              onClick={handleStop}
              style={{
                flex: 1,
                height: "48px",
                minWidth: 0,
                background: "transparent",
                border: "1.5px solid #666",
                borderRadius: "12px",
                color: "#F5F0E8",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "0 10px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ⏹ {t(language, "voice.stop")}
            </button>
            {/* Tap to ask — flex:1 bằng Stop */}
            <button
              onClick={handleAskPress}
              style={{
                flex: 1,
                height: "48px",
                minWidth: 0,
                background: "#C9A84C",
                border: "none",
                borderRadius: "12px",
                color: "#0A0A0A",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "DM Sans, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "0 10px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {inputMode === "voice" ? `🎙 ${t(language, "voice.ask")}` : `⌨️ ${t(language, "voice.ask")}`}
            </button>
            {/* Icon chuyển mode — tách riêng, click thẳng vào mode đích */}
            <button
              onClick={inputMode === "voice" ? switchToText : switchToVoice}
              aria-label={inputMode === "voice" ? "Switch to text input" : "Switch to voice input"}
              style={{
                width: "44px",
                height: "44px",
                flexShrink: 0,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                border: `1.5px solid ${inputMode === "text" ? "#C9A84C" : "#444"}`,
                color: inputMode === "text" ? "#C9A84C" : "#888",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {inputMode === "voice" ? "⌨️" : "🎤"}
            </button>
          </div>
        ) : is.draining ? (
          <div style={{ width: "100%", maxWidth: "320px", textAlign: "center", color: "#C9A84C", fontSize: 14 }}>
            ⏳ {language === "vi" ? "Đang chờ AI dừng lượt cũ..." : "Waiting old AI turn to stop..."}
          </div>
        ) : is.paused ? (
          // [FIX 7] paused: chỉ Resume + Ask, ẩn toggle mode
          <div style={{ width: "100%", maxWidth: "360px", display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleResume}
              style={{
                flex: 1, height: "48px", minWidth: 0,
                background: "transparent", border: "1.5px solid #666",
                borderRadius: "12px", color: "#F5F0E8",
                fontSize: "15px", fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: "6px", padding: "0 10px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              ▶ {t(language, "voice.resume")}
            </button>
            <button
              onClick={handleAskPress}
              style={{
                flex: 1, height: "48px", minWidth: 0,
                background: "#C9A84C", border: "none",
                borderRadius: "12px", color: "#0A0A0A",
                fontSize: "15px", fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: "6px", padding: "0 10px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
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
                height: "48px",
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
                height: "48px",
                padding: "0 16px",
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
          <div style={{ width: "100%", maxWidth: "360px", display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleAskPress}
              disabled={is.inputBlocked}
              style={{
                flex: 1, height: "48px", minWidth: 0,
                borderRadius: "12px", border: "none",
                cursor: is.inputBlocked ? "not-allowed" : "pointer",
                background: `linear-gradient(135deg, ${goldLight}, ${goldBright})`,
                color: "#0A0A0A", fontFamily: "DM Sans, sans-serif",
                fontSize: "15px", fontWeight: "600",
                transition: "all 0.2s ease",
                opacity: is.inputBlocked ? 0.7 : 1,
                boxShadow: "0 12px 30px rgba(246,196,83,0.38)",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "6px", padding: "0 10px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {isProcessingState
                ? `⏳ ${t(language, "voice.processing")}`
                : inputMode === "text"
                  ? `⌨️ ${t(language, "voice.ask")}`
                  : showIntroButton && is.ready
                    ? `🎵 ${t(language, "voice.listen_guide")}`
                    : `🎙 ${t(language, "voice.ask")}`}
            </button>
            {/* Toggle ⌨️/🎤 — hiện khi ready và đã qua intro */}
            {is.ready && !showIntroButton && !isProcessingState && (
              <button
                onClick={() => inputMode === "voice" ? switchToText() : switchToVoice()}
                style={{
                  width: "40px", height: "48px", flexShrink: 0,
                  borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)",
                  background: inputMode === "text" ? "rgba(201,168,76,0.15)" : "transparent",
                  color: inputMode === "text" ? "#C9A84C" : "#666",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: "16px", transition: "all 0.2s",
                }}
                aria-label={inputMode === "voice" ? "Switch to text input" : "Switch to voice input"}
              >
                {inputMode === "voice" ? "⌨️" : "🎤"}
              </button>
            )}
          </div>
        )}
        {/* Text input panel — in-flow */}
        {showTextInput && (
          <div
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#111",
              borderTop: "1px solid #333",
              padding: "12px 16px",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              zIndex: 200,
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
                minWidth: 0,
                height: "44px",
                background: "#1a1a1a",
                border: "1px solid #444",
                borderRadius: "22px",
                padding: "0 16px",
                color: "#F5F0E8",
                fontSize: "15px",
                fontFamily: "DM Sans, sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => {
                // blur trước để iOS dismiss keyboard, tránh body bị offset
                textInputRef.current?.blur();
                setShowTextInput(false);
                setTextInput("");
                setInputMode("voice");
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
                whiteSpace: "nowrap",
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
