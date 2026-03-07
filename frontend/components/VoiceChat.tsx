"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { t } from "@/lib/i18n";
import { LanguageCode } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

type Props = {
  artifactId: string;
  language: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  museumName?: string;
};

type State = "connecting" | "ready" | "recording" | "processing" | "ai_speaking";

type Message = {
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
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
  fr: { flag: "🇫🇷" },
  zh: { flag: "🇨🇳" },
  ja: { flag: "🇯🇵" },
  ko: { flag: "🇰🇷" },
};

export default function VoiceChat({ artifactId, language, onLanguageChange, museumName }: Props) {
  const router = useRouter();
  const [state, _setState] = useState<State>("connecting");
  const stateRef = useRef<State>("connecting");
  const setState = (s: State) => { stateRef.current = s; _setState(s); };
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIText, setCurrentAIText] = useState("");
  const [, setCurrentUserText] = useState("");
  const [artifactName, setArtifactName] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showIntroButton, setShowIntroButton] = useState<boolean>(true);
  const [autoStopHint, setAutoStopHint] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const autoStopHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs — không gây re-render
  const lastProcessedIndexRef = useRef<number>(-1);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForAudioRef = useRef(false);
  const pendingAITextRef = useRef("");
  const pendingUserTextRef = useRef("");
  const hasAiOutputThisTurnRef = useRef(false);
  // Khi user interrupt → bỏ qua mọi message cho đến turn_complete tiếp theo (của turn CŨ)
  const skipOldTurnRef = useRef(false);

  const { isConnected, messages: wsMessages, sendMessage } = useWebSocket(artifactId, language);
  const { start, stop: stopRecording } = useAudioRecorder();
  const { playChunk, stopPlayback, stop: stopAudio, isPlaying, unlockAndFlush } = useAudioPlayer();
  const sentences = useMemo(
    () => messages.filter((m) => m.role === "assistant").map((m) => m.text),
    [messages],
  );

  const markIntroUsed = useCallback(() => {
    setShowIntroButton(false);
  }, []);

  // ─── Load exhibit name ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/exhibits/${artifactId}`)
      .then((r) => r.json())
      .then((data) => setArtifactName(data.data?.name || ""))
      .catch((e) => console.error("Failed to load exhibit:", e));
  }, [artifactId]);

  useEffect(() => {
    setShowIntroButton(true);
  }, [artifactId]);

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

  // Auto-greeting được xử lý bởi backend ngay sau khi connect

  // ─── Khi audio phát xong, nếu đang chờ → về ready ────────────────────
  useEffect(() => {
    if (!isPlaying && waitingForAudioRef.current) {
      // Không override nếu user đã bắt đầu ghi âm hoặc đang xử lý
      if (stateRef.current === "recording" || stateRef.current === "processing") {
        waitingForAudioRef.current = false;
        return;
      }
      // Chỉ tự về ready sau khi AI đã thực sự ở trạng thái speaking.
      if (stateRef.current !== "ai_speaking") {
        waitingForAudioRef.current = false;
        return;
      }
      console.log("🔇 Audio finished → ready");
      waitingForAudioRef.current = false;
      setState("ready");
    }
  }, [isPlaying]);

  // ─── Xử lý WS messages (chỉ depend vào wsMessages) ───────────────────
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

      // ── Đang skip turn cũ (user đã interrupt) ──
      if (skipOldTurnRef.current) {
        if (msg.type === "turn_complete") {
          // Turn cũ kết thúc → clear flag, xử lý bình thường từ message tiếp theo
          console.log("⏭️ Old turn_complete skipped, resuming normal processing");
          skipOldTurnRef.current = false;
        }
        continue;
      }

      // ── User transcript ──
      if ((msg.type === "user_transcript" || msg.type === "user_text") && (msg.data || msg.text)) {
        const txt = msg.data || msg.text;
        pendingUserTextRef.current = txt;
        setCurrentUserText(txt);
      }

      // ── Audio chunk từ AI ──
      if ((msg.type === "audio_chunk" || msg.type === "audio") && (msg.data || msg.audio)) {
        const audioData = msg.data || msg.audio;
        // Khi recording → không phát audio
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
      if ((msg.type === "transcript" || msg.type === "text") && (msg.data || msg.text)) {
        if (stateRef.current === "recording") continue;
        const txt = msg.data || msg.text;
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

        // Nếu user đang recording → bỏ qua, không chuyển state
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
  }, [wsMessages]); // CHỈ depend vào wsMessages — không include isPlaying, playChunk, etc.

  useEffect(() => {
    if (sentences.length > 0 || currentAIText) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [sentences, currentAIText]);

  // ─── Clear timeout khi unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      stopRecording();
      stopAudio();
    };
  }, []);

  const stopAndSendTurn = useCallback((reason: "manual" | "silence" | "no_speech") => {
    if (stateRef.current !== "recording") return;
    console.log(`⏹️ Stop recording → end_of_turn (${reason})`);
    stopRecording();
    if (reason === "no_speech") {
      setState("ready");
      setAutoStopHint("Không nghe rõ giọng nói, vui lòng thử lại");
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 2200);
      return;
    }

    const sent = sendMessage({ type: "end_of_turn" });
    if (!sent) {
      console.warn("⚠️ end_of_turn not sent because websocket is not open");
    } else {
      const museumId = typeof window !== "undefined" ? localStorage.getItem("museum_id") || "demo_museum" : "demo_museum";
      trackEvent("question_asked", museumId, artifactId, { reason });
    }
    setState("processing");
    hasAiOutputThisTurnRef.current = false;
    if (reason === "silence") {
      setAutoStopHint("Đã tự gửi khi bạn dừng nói");
      if (autoStopHintTimerRef.current) clearTimeout(autoStopHintTimerRef.current);
      autoStopHintTimerRef.current = setTimeout(() => setAutoStopHint(""), 2200);
    }

    // Timeout 15s: nếu Gemini không trả lời → giữ processing để tránh nhảy UI.
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

    // Dừng audio + đánh dấu skip mọi message còn lại từ turn CŨ
    stopPlayback();
    waitingForAudioRef.current = false;
    pendingAITextRef.current = "";
    setCurrentAIText("");
    setCurrentUserText("");
    pendingUserTextRef.current = "";

    if (stateRef.current === "ai_speaking") {
      // AI đang nói → skip toàn bộ message đến turn_complete
      skipOldTurnRef.current = true;
      sendMessage({ type: "interrupt" });
    }

    // SET STATE NGAY — trước await để stateRef block audio chunks
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
  }, [isConnected, stopPlayback, sendMessage, start, unlockAndFlush, markIntroUsed, stopAndSendTurn]);

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

  const isRecordingState = state === "recording";
  const isSpeakingState = state === "ai_speaking";
  const isProcessingState = state === "processing";
  const isDisabledMic = isSpeakingState || state === "connecting" || isProcessingState;
  const goldBright = "#F6C453";
  const goldLight = "#FFE08A";
  const goldRing = "rgba(246,196,83,0.72)";
  const goldRingSoft = "rgba(255,224,138,0.45)";

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
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
            {artifactName || "Loading..."}
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
          padding: "20px 16px 12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: sentences.length === 0 && !currentAIText ? "center" : "flex-start",
        }}
      >
        {sentences.length === 0 && !currentAIText ? (
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
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {sentences.map((s, i) => (
              <p
                key={`${i}-${s.slice(0, 12)}`}
                style={{
                  color: "#F5F0E8",
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "17px",
                  fontStyle: "italic",
                  lineHeight: 1.7,
                  margin: 0,
                  padding: "12px 16px",
                  backgroundColor: "rgba(201,168,76,0.06)",
                  borderLeft: "2px solid rgba(201,168,76,0.4)",
                  borderRadius: "0 8px 8px 0",
                  animation: "fadeInUp 0.4s ease",
                }}
              >
                {s}
              </p>
            ))}
            {currentAIText && (
              <p
                style={{
                  color: "#F5F0E8",
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: "17px",
                  fontStyle: "italic",
                  lineHeight: 1.7,
                  margin: 0,
                  padding: "12px 16px",
                  backgroundColor: "rgba(201,168,76,0.06)",
                  borderLeft: "2px solid rgba(201,168,76,0.4)",
                  borderRadius: "0 8px 8px 0",
                  animation: "fadeInUp 0.4s ease",
                }}
              >
                {currentAIText}
              </p>
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
              opacity: isDisabledMic ? 0.82 : 1,
            }}
          >
            {isRecordingState ? "" : "🎤"}
          </button>
        </div>

        <button
          onClick={isSpeakingState ? handleInterrupt : handleMicPress}
          disabled={state === "connecting"}
          style={{
            width: "100%",
            maxWidth: "320px",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            cursor: state === "connecting" ? "not-allowed" : "pointer",
            background: isSpeakingState
              ? "linear-gradient(135deg, #4b1111, #7f1d1d)"
              : `linear-gradient(135deg, ${goldLight}, ${goldBright})`,
            color: isSpeakingState ? "#fca5a5" : "#0A0A0A",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "15px",
            fontWeight: "600",
            transition: "all 0.2s ease",
            opacity: state === "connecting" ? 0.7 : 1,
            boxShadow: isSpeakingState
              ? "0 12px 26px rgba(127,29,29,0.35)"
              : "0 12px 30px rgba(246,196,83,0.38)",
          }}
        >
          {showIntroButton && state === "ready"
            ? `🎵 ${t(language, "voice.listen_guide")}`
            : isRecordingState
            ? `🔴 ${t(language, "voice.recording")}`
            : isProcessingState
            ? `⏳ ${t(language, "voice.processing")}`
            : isSpeakingState
            ? "✋ Nhấn để dừng"
            : `🎙 ${t(language, "voice.ask")}`}
        </button>
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
      </div>
    </div>
  );
}
