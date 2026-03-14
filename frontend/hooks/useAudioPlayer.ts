import { useCallback, useRef, useState } from "react";

const STREAM_SAMPLE_RATE = 24000;
const BUFFER_DELAY_SEC = 0.02;

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const isUnlockedRef = useRef(false);
  const pendingChunksRef = useRef<string[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const stopDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getOrCreateContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      // Keep context sample rate aligned with incoming PCM stream when possible.
      try {
        audioContextRef.current = new AudioContext();
      } catch {
        audioContextRef.current = new AudioContext();
      }
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

    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    return float32;
  };

  const scheduleChunk = useCallback(async (ctx: AudioContext, base64: string) => {
    try {
      const float32 = decodePcmChunk(base64);
      const audioBuffer = ctx.createBuffer(1, float32.length, STREAM_SAMPLE_RATE);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
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
          }, 150);
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
      const ctx = getOrCreateContext();
      if (ctx.state !== "running") {
        await ctx.resume();
      }
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
  }, [flushPending]);

  const playChunk = useCallback(async (base64: string) => {
    try {
      const ctx = getOrCreateContext();

      if (ctx.state !== "running") {
        try {
          await ctx.resume();
        } catch (e) {
          console.warn("⚠️ AudioContext resume failed in playChunk:", e);
        }
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
  }, [flushPending, scheduleChunk]);

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
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
    isUnlockedRef.current = false;
    setIsUnlocked(false);
  }, [stopPlayback]);

  const getContext = useCallback((): AudioContext | null => {
    return audioContextRef.current;
  }, []);

  return { playChunk, stopPlayback, stop, isPlaying, isUnlocked, unlockAndFlush, getContext };
}
