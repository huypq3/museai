"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { t } from "@/lib/i18n";
import TranscriptDisplay from "@/components/TranscriptDisplay";

type Props = {
  artifactId: string;
  language: string;
  onLanguageChange?: (lang: string) => void;
  museumName?: string;
};

type State = "connecting" | "ready" | "recording" | "processing" | "ai_speaking";

type Message = {
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
};

const LANGUAGES: Record<string, { flag: string }> = {
  vi: { flag: '🇻🇳' },
  en: { flag: '🇬🇧' },
  fr: { flag: '🇫🇷' },
  zh: { flag: '🇨🇳' },
  ja: { flag: '🇯🇵' },
  ko: { flag: '🇰🇷' },
};

export default function VoiceChat({ artifactId, language, onLanguageChange, museumName }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>("connecting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAIText, setCurrentAIText] = useState("");
  const [currentUserText, setCurrentUserText] = useState("");
  const [artifactName, setArtifactName] = useState("");
  const [artifactEra, setArtifactEra] = useState("");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const lastProcessedIndexRef = useRef<number>(-1);
  const pendingTurnCompleteRef = useRef(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiStreamingRef = useRef(false);
  const lastAudioChunkTimeRef = useRef<number>(0);
  const hasGreetedRef = useRef(false);
  
  const museumId = typeof window !== 'undefined' 
    ? localStorage.getItem('museum_id') || 'demo_museum'
    : 'demo_museum';
  
  // Always connect (no idle state)
  const shouldConnect = true;
  const { isConnected, messages: wsMessages, sendMessage } = useWebSocket(
    shouldConnect ? artifactId : null,
    language
  );
  const { start, stop: stopRecording } = useAudioRecorder();
  const { playChunk, stop: stopAudio, isPlaying } = useAudioPlayer();

  const clearProcessingTimeout = () => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  };

  // Load artifact name and era
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/artifacts/${artifactId}`)
      .then(r => r.json())
      .then(data => {
        setArtifactName(data.data?.name || '')
        setArtifactEra(data.data?.era || '')
      })
      .catch(e => console.error('Failed to load artifact:', e))
  }, [artifactId])

  // Auto-transition to ready when connected
  useEffect(() => {
    if (isConnected && state === "connecting") {
      console.log("✅ Connected - ready to interact");
      setState("ready");
    }
  }, [isConnected, state]);

  // Auto-greeting: Trigger AI to greet user after 2 seconds
  useEffect(() => {
    if (!isConnected || hasGreetedRef.current || !artifactName) return;
    
    const greetingTimer = setTimeout(() => {
      console.log("🎙️ Sending auto-greeting prompt...");
      hasGreetedRef.current = true;
      
      const languageMap: Record<string, string> = {
        vi: 'Tiếng Việt',
        en: 'English',
        fr: 'Français',
        ja: '日本語',
        ko: '한국어',
        zh: '中文'
      };
      
      const greetingText = `Hãy chào khách tham quan và giới thiệu ngắn gọn về ${artifactName} trong 2-3 câu. Trả lời bằng ${languageMap[language] || 'Tiếng Việt'}. Giọng thân thiện như hướng dẫn viên bảo tàng.`;
      
      sendMessage({ type: "text", data: greetingText });
      setState("processing");
      console.log("📤 Sent auto-greeting:", greetingText.slice(0, 80) + "...");
    }, 2000);
    
    return () => clearTimeout(greetingTimer);
  }, [isConnected, artifactName, language, sendMessage]);

  useEffect(() => {
    // If socket drops while interacting, go back to connecting state.
    if (!isConnected && state !== "connecting") {
      clearProcessingTimeout();
      setState("connecting");
    }
  }, [isConnected, state]);

  useEffect(() => {
    if (!isPlaying && pendingTurnCompleteRef.current) {
      pendingTurnCompleteRef.current = false;
      setState("ready");
      console.log("✅ Playback finished - ready for next turn");
    }
  }, [isPlaying]);

  // Failsafe: If AI is speaking but no new chunks for 3 seconds, assume done
  useEffect(() => {
    if (state === "ai_speaking" && aiStreamingRef.current) {
      const checkInterval = setInterval(() => {
        const timeSinceLastChunk = Date.now() - lastAudioChunkTimeRef.current;
        if (timeSinceLastChunk > 3000 && !isPlaying) {
          console.warn("⚠️ No audio chunks for 3s and not playing - assuming turn complete");
          aiStreamingRef.current = false;
          setState("ready");
        }
      }, 1000);
      
      return () => clearInterval(checkInterval);
    }
  }, [state, isPlaying]);

  useEffect(() => {
    if (wsMessages.length === 0) return;
    
    const startIndex = lastProcessedIndexRef.current + 1;
    if (startIndex >= wsMessages.length) return;
    
    console.log(`📥 Processing NEW messages from index ${startIndex} to ${wsMessages.length - 1}`);
    
    for (let i = startIndex; i < wsMessages.length; i++) {
      const msg = wsMessages[i];
      console.log(`  [${i}] type: ${msg.type}`);
      
      if (msg.type === "ready" || msg.type === "session_ready") {
        console.log("✅ Backend ready");
        continue;
      }
      
      if ((msg.type === "user_transcript" || msg.type === "user_text") && (msg.data || msg.text)) {
        const userText = msg.data || msg.text;
        console.log(`👤 [${i}] User said: ${userText}`);
        setCurrentUserText(userText);
      }

      if ((msg.type === "audio_chunk" || msg.type === "audio") && (msg.data || msg.audio)) {
        clearProcessingTimeout();
        aiStreamingRef.current = true;
        lastAudioChunkTimeRef.current = Date.now();
        const audioData = msg.data || msg.audio;
        console.log(`🔊 [${i}] Playing audio chunk (${audioData.length} chars)`);
        playChunk(audioData);
        setState("ai_speaking");
      }
      
      if ((msg.type === "text" || msg.type === "transcript") && (msg.data || msg.text)) {
        const textData = msg.data || msg.text;
        console.log(`📝 [${i}] AI text: ${textData.substring(0, 50)}...`);
        setCurrentAIText(prev => prev + textData);
      }

      if (msg.type === "interrupted") {
        clearProcessingTimeout();
        console.log("⚠️ Gemini interrupted current response");
        stopAudio();
        pendingTurnCompleteRef.current = false;
        setState("ready");
      }
      
      if (msg.type === "turn_complete") {
        clearProcessingTimeout();
        aiStreamingRef.current = false;
        console.log(`✅✅✅ [${i}] TURN_COMPLETE RECEIVED - state before: ${state}, isPlaying: ${isPlaying}`);
        
        if (currentUserText) {
          setMessages(msgs => [...msgs, {
            role: "user",
            text: currentUserText,
            timestamp: new Date()
          }]);
          setCurrentUserText("");
        }
        
        setCurrentAIText(prev => {
          if (prev) {
            setMessages(msgs => [...msgs, {
              role: "assistant",
              text: prev,
              timestamp: new Date()
            }]);
          }
          return "";
        });
        
        // Wait for audio to finish playing before transitioning to ready
        // Use a longer delay if audio is still playing
        const timeSinceLastChunk = Date.now() - lastAudioChunkTimeRef.current;
        let delay = 100;
        
        if (isPlaying && timeSinceLastChunk < 2000) {
          // Audio recently received and still playing - wait longer
          delay = 1000;
        }
        
        console.log(`⏰ Setting ready state in ${delay}ms (isPlaying: ${isPlaying}, timeSinceLastChunk: ${timeSinceLastChunk}ms)`);
        setTimeout(() => {
          setState("ready");
          pendingTurnCompleteRef.current = false;
          console.log("✅ Turn complete - transitioned to ready");
        }, delay);
      }
    }
    
    lastProcessedIndexRef.current = wsMessages.length - 1;
    console.log(`✅ Updated lastProcessedIndex to ${lastProcessedIndexRef.current}`);
  }, [wsMessages, playChunk, currentUserText, currentAIText, isPlaying, stopAudio]);

  const handleStartRecording = async () => {
    console.log(`🎤 handleStartRecording called, current state: ${state}, isConnected: ${isConnected}`);
    
    // Force reset if stuck in processing/ai_speaking
    if (state === "processing" || state === "ai_speaking") {
      console.warn("⚠️ Force resetting from stuck state:", state);
      stopAudio();
      clearProcessingTimeout();
      setState("ready");
      // Give a brief moment for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (state !== "ready") {
      console.warn("⚠️ Not ready, current state:", state);
      return;
    }
    
    if (!isConnected) {
      console.warn("⚠️ Not connected, setting connecting state");
      setState("connecting");
      return;
    }

    clearProcessingTimeout();
    setCurrentUserText("");
    console.log("✅ Starting audio recording...");
    await start((base64) => {
      sendMessage({ type: "audio", data: base64 });
    });
    setState("recording");
  };

  const handleStopRecording = () => {
    if (state !== "recording") return;
    console.log("🛑 Stopping recording, sending end_of_turn");
    stopRecording();
    sendMessage({ type: "end_of_turn" });
    setState("processing");
    clearProcessingTimeout();
    processingTimeoutRef.current = setTimeout(() => {
      console.warn("⚠️ Processing timeout - returning to ready");
      setState("ready");
    }, 12000);
  };

  const handleInterrupt = () => {
    console.log("🛑 Interrupt AI response");
    clearProcessingTimeout();
    stopAudio();
    sendMessage({ type: "interrupt" });
    setCurrentAIText("");
    setState("ready");
  };

  const handleBack = () => {
    // Disconnect WebSocket and cleanup
    stopRecording();
    stopAudio();
    // Navigate back to camera tour
    router.push('/camera-tour');
  };

  useEffect(() => {
    return () => {
      clearProcessingTimeout();
      stopRecording();
      stopAudio();
    };
  }, [stopRecording, stopAudio]);

  return (
    <div className="flex flex-col h-full">
      {/* Header - redesigned */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Nút ← quay về camera */}
        <button
          onClick={handleBack}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            color: '#F5F0E8',
            fontSize: 18,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ←
        </button>

        {/* Center: Tên bảo tàng (trên) + Tên hiện vật (dưới) */}
        <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
          {museumName && (
            <div style={{
              fontSize: 11,
              color: 'rgba(201,168,76,0.7)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}>
              {museumName}
            </div>
          )}
          <div style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 17,
            fontWeight: 500,
            color: '#F5F0E8',
          }}>
            {artifactName || 'Loading...'}
          </div>
        </div>

        {/* Ngôn ngữ — chỉ 1 cái duy nhất */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              fontSize: 20,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {LANGUAGES[language]?.flag || '🌐'}
          </button>
          
          {/* Language dropdown */}
          {showLangMenu && onLanguageChange && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 48,
              background: 'rgba(20,20,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              overflow: 'hidden',
              zIndex: 50,
            }}>
              {Object.entries(LANGUAGES).map(([lang, { flag }]) => (
                <button
                  key={lang}
                  onClick={() => {
                    onLanguageChange(lang);
                    setShowLangMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: language === lang ? 'rgba(201,168,76,0.2)' : 'transparent',
                    border: 'none',
                    color: '#F5F0E8',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'DM Sans',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{flag}</span>
                  <span>{lang.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-col flex-1 p-4 gap-4">
      {/* Transcript Display */}
      {(messages.length > 0 || currentAIText) && (
        <TranscriptDisplay
          messages={messages}
          isListening={state === "ai_speaking"}
          currentSpeech={currentAIText}
        />
      )}

      {/* Wave Visualizer */}
      {(state === "recording" || state === "ai_speaking") && (
        <div className="flex items-end justify-center gap-1 h-16">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all"
              style={{
                height: `${20 + Math.random() * 60}%`,
                background: state === "recording" ? "#ef4444" : "var(--gold)",
                animation: `wave 0.8s ease-in-out infinite`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main Control Area */}
      <div className="flex-1 flex items-center justify-center">
        {state === "connecting" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="font-display italic" style={{ color: 'var(--museum-dim)', fontSize: '16px' }}>
              {t(language, 'voice.connecting')}
            </p>
          </div>
        )}

        {state === "ready" && (
          <div className="text-center">
            <p className="font-display text-lg italic" style={{ color: 'var(--museum-white)' }}>
              {t(language, 'voice.listening')}
            </p>
          </div>
        )}

        {state === "recording" && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full mb-4 mx-auto flex items-center justify-center"
                 style={{ background: 'rgba(239,68,68,0.2)' }}>
              <div className="w-16 h-16 bg-red-500 rounded-full animate-pulse flex items-center justify-center">
                <span className="text-3xl">🎤</span>
              </div>
            </div>
            <p className="font-display text-lg mb-2" style={{ color: 'var(--museum-white)' }}>
              {t(language, 'voice.recording')}
            </p>
            <p className="text-xs" style={{ color: 'var(--museum-dim)', fontFamily: 'DM Sans' }}>
              {t(language, 'voice.stop_hint')}
            </p>
          </div>
        )}

        {state === "processing" && (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm" style={{ color: 'var(--museum-dim)', fontFamily: 'DM Sans' }}>
              {t(language, 'voice.processing')}
            </p>
          </div>
        )}

        {state === "ai_speaking" && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full mb-4 mx-auto flex items-center justify-center"
                 style={{ background: 'var(--gold-dim)' }}>
              <div className="w-16 h-16 rounded-full animate-pulse flex items-center justify-center"
                   style={{ background: 'var(--gold)' }}>
                <span className="text-3xl">🤖</span>
              </div>
            </div>
            <p className="font-display text-lg" style={{ color: 'var(--museum-white)' }}>
              {t(language, 'voice.ai_speaking')}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex gap-3">
        {/* Mic button - primary action */}
        <button
          onClick={state === "recording" ? handleStopRecording : handleStartRecording}
          disabled={state === "connecting" || state === "processing"}
          className="flex-1 h-[52px] rounded-[14px] font-medium text-[15px] transition-all disabled:opacity-50 hover:brightness-110"
          style={{
            background: state === "recording" ? "#ef4444" : "var(--gold)",
            color: state === "recording" ? "#fff" : "var(--museum-dark)",
            fontFamily: 'DM Sans',
          }}>
          {state === "recording" ? `⏹️ ${t(language, 'voice.stop')}` : `🎤 ${t(language, 'voice.ask')}`}
        </button>
        
        {/* Interrupt button - only visible when AI speaking */}
        {state === "ai_speaking" && (
          <button
            onClick={handleInterrupt}
            className="w-[50px] h-[52px] rounded-xl flex items-center justify-center text-xl transition-all hover:brightness-110"
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}>
            ✋
          </button>
        )}
      </div>

      {/* Wave animation CSS */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      </div> {/* Close content area */}
    </div>
  );
}
