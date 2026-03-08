import { useCallback, useEffect, useRef, useState } from "react";

const STREAM_SAMPLE_RATE = 24000;
const BUFFER_DELAY_SEC = 0.1;
const PLAYBACK_GAIN = 1.0;
const EDGE_FADE_SAMPLES = 96;

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const isUnlockedRef = useRef(false);
  const pendingChunksRef = useRef<string[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const stopDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iosPrimeDoneRef = useRef(false);

  const isIOS = (): boolean => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  const primeIosAudioRoute = async () => {
    if (!isIOS() || iosPrimeDoneRef.current) return;
    try {
      const a = new Audio(
        "data:audio/mp3;base64,SUQzAwAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//uQxAADBzQAFhI0AAADaAAAArkxBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      );
      a.muted = true;
      a.setAttribute("playsinline", "true");
      await a.play();
      a.pause();
      a.currentTime = 0;
      iosPrimeDoneRef.current = true;
      console.log("📱 iOS audio route primed");
    } catch (e) {
      console.warn("iOS audio priming failed:", e);
    }
  };

  const getContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      // Let iOS choose device sample rate for best compatibility.
      audioContextRef.current = new AudioContext({ latencyHint: "interactive" });
      nextStartTimeRef.current = 0;
      console.log("🎚️ AudioContext created", {
        state: audioContextRef.current.state,
        sampleRate: audioContextRef.current.sampleRate,
      });
    }
    return audioContextRef.current;
  };

  const decodePcmChunk = (base64: string): Float32Array => {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Decode as little-endian PCM16 explicitly to avoid platform assumptions.
    const sampleCount = Math.floor(bytes.byteLength / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
    const float32 = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const sample = view.getInt16(i * 2, true);
      float32[i] = Math.max(-1, Math.min(1, sample / 32768.0));
    }
    return float32;
  };

  const applyEdgeFade = (samples: Float32Array): void => {
    if (samples.length < 8) return;
    const fade = Math.min(EDGE_FADE_SAMPLES, Math.floor(samples.length / 4));
    if (fade <= 0) return;

    for (let i = 0; i < fade; i++) {
      const gain = i / fade;
      samples[i] *= gain;
      samples[samples.length - 1 - i] *= gain;
    }
  };

  const tryResumeContext = useCallback(async (): Promise<AudioContext | null> => {
    const ctx = getContext();
    if (ctx.state === "running") return ctx;
    try {
      await ctx.resume();
      const resumedState = getContext().state;
      if (resumedState !== "running") {
        console.warn("⚠️ AudioContext resume attempted but still not running", { state: ctx.state });
        return null;
      }
      return ctx;
    } catch (e) {
      console.warn("AudioContext resume failed:", e);
      return null;
    }
  }, []);

  const scheduleChunk = useCallback(async (ctx: AudioContext, base64: string) => {
    try {
      const float32 = decodePcmChunk(base64);
      applyEdgeFade(float32);
      const audioBuffer = ctx.createBuffer(1, float32.length, STREAM_SAMPLE_RATE);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = PLAYBACK_GAIN;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + BUFFER_DELAY_SEC;
      }
      const startAt = nextStartTimeRef.current;
      source.start(startAt);
      nextStartTimeRef.current += audioBuffer.duration;

      if (stopDebounceRef.current) {
        clearTimeout(stopDebounceRef.current);
        stopDebounceRef.current = null;
      }
      setIsPlaying(true);
      activeSourcesRef.current.push(source);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);

        if (activeSourcesRef.current.length === 0) {
          stopDebounceRef.current = setTimeout(() => {
            const c = audioContextRef.current;
            if (
              activeSourcesRef.current.length === 0 &&
              (!c || nextStartTimeRef.current <= c.currentTime + 0.1)
            ) {
              setIsPlaying(false);
              console.log("🔇 Audio playback finished");
            }
          }, 350);
        }
      };

      console.log("🔊 Playing chunk", {
        samples: float32.length,
        duration: audioBuffer.duration.toFixed(3),
        startAt: startAt.toFixed(3),
        ctxState: ctx.state,
        ctxRate: ctx.sampleRate,
      });
    } catch (err) {
      console.error("❌ scheduleChunk error:", err);
    }
  }, []);

  const flushPending = useCallback(async (ctx: AudioContext) => {
    const pending = pendingChunksRef.current.splice(0);
    for (const chunk of pending) {
      await scheduleChunk(ctx, chunk);
    }
  }, [scheduleChunk]);

  const warmUpOutput = (ctx: AudioContext) => {
    try {
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = silentBuffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {
      console.warn("Audio warm-up failed:", e);
    }
  };

  const unlockAndFlush = useCallback(async () => {
    if (isUnlockedRef.current) return;
    try {
      await primeIosAudioRoute();
      const ctx = await tryResumeContext();
      if (!ctx) return;
      if (ctx.state === "running") {
        warmUpOutput(ctx);
        isUnlockedRef.current = true;
        setIsUnlocked(true);
        console.log("🔓 AudioContext unlocked", { sampleRate: ctx.sampleRate });
        await flushPending(ctx);
      } else {
        console.warn("⚠️ AudioContext still not running after unlock", { state: ctx.state });
      }
    } catch (e) {
      console.warn("AudioContext unlock failed:", e);
    }
  }, [flushPending, tryResumeContext]);

  const playChunk = useCallback(async (base64: string) => {
    try {
      let ctx = getContext();

      if (ctx.state !== "running") {
        const resumed = await tryResumeContext();
        if (resumed) ctx = resumed;
      }

      if (ctx.state !== "running") {
        pendingChunksRef.current.push(base64);
        console.log("⏸️ AudioContext suspended, buffering chunk", {
          pending: pendingChunksRef.current.length,
          state: ctx.state,
        });
        return;
      }

      if (!isUnlockedRef.current) {
        isUnlockedRef.current = true;
        setIsUnlocked(true);
      }

      if (pendingChunksRef.current.length > 0) {
        await flushPending(ctx);
      }

      await scheduleChunk(ctx, base64);
    } catch (err) {
      console.error("❌ playChunk error:", err);
    }
  }, [flushPending, scheduleChunk, tryResumeContext]);

  const stopPlayback = useCallback(() => {
    if (stopDebounceRef.current) {
      clearTimeout(stopDebounceRef.current);
      stopDebounceRef.current = null;
    }

    pendingChunksRef.current = [];

    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];

    const ctx = audioContextRef.current;
    if (ctx) {
      nextStartTimeRef.current = ctx.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }

    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    stopPlayback();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
    isUnlockedRef.current = false;
    setIsUnlocked(false);
  }, [stopPlayback]);

  useEffect(() => {
    const tryResumeOnLifecycle = async () => {
      if (!audioContextRef.current) return;
      await tryResumeContext();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void tryResumeOnLifecycle();
      }
    };

    const onPageShow = () => {
      void tryResumeOnLifecycle();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [tryResumeContext]);

  return { playChunk, stopPlayback, stop, isPlaying, isUnlocked, unlockAndFlush };
}
