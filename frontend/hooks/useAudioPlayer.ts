import { useCallback, useRef, useState } from "react";

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const stopDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Buffer chunks received before AudioContext is unlocked
  const pendingChunksRef = useRef<string[]>([]);
  const isUnlockedRef = useRef(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // ─── Tạo hoặc lấy AudioContext ────────────────────────────────────────
  const getContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;
    }
    return audioContextRef.current;
  };

  // ─── Unlock AudioContext khi có user gesture ──────────────────────────
  // Browser autoplay policy: AudioContext bắt đầu "suspended", cần user gesture để resume.
  const unlockAndFlush = useCallback(async () => {
    if (isUnlockedRef.current) return;
    try {
      const ctx = getContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      if (ctx.state === "running") {
        isUnlockedRef.current = true;
        setIsUnlocked(true);
        console.log("🔓 AudioContext unlocked");
        // Phát các chunks đang chờ
        const pending = pendingChunksRef.current.splice(0);
        for (const chunk of pending) {
          await _playChunkInternal(ctx, chunk);
        }
      }
    } catch (e) {
      console.warn("AudioContext unlock failed:", e);
    }
  }, []);
  // ─── Internal: schedule và phát 1 chunk ───────────────────────────────
  const _playChunkInternal = async (ctx: AudioContext, base64: string) => {
    try {
      // Base64 → Uint8Array
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // PCM Int16 → Float32
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // Tạo AudioBuffer
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.25;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Schedule seamless — tiếp nối ngay sau chunk trước
      const currentTime = ctx.currentTime;
      const startTime = Math.max(nextStartTimeRef.current, currentTime);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      // Hủy debounce stop (có chunk mới)
      if (stopDebounceRef.current) {
        clearTimeout(stopDebounceRef.current);
        stopDebounceRef.current = null;
      }
      setIsPlaying(true);
      activeSourcesRef.current.push(source);

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx > -1) activeSourcesRef.current.splice(idx, 1);

        // Chỉ set isPlaying=false sau debounce 400ms để tránh false-negative
        if (activeSourcesRef.current.length === 0) {
          stopDebounceRef.current = setTimeout(() => {
            const c = audioContextRef.current;
            if (
              activeSourcesRef.current.length === 0 &&
              (!c || nextStartTimeRef.current <= c.currentTime + 0.1)
            ) {
              console.log("🔇 Audio playback finished");
              setIsPlaying(false);
            }
          }, 400);
        }
      };

      console.log(`🔊 Playing chunk: ${float32.length} samples, ${audioBuffer.duration.toFixed(2)}s`);
    } catch (err) {
      console.error("❌ playChunkInternal error:", err);
    }
  };

  // ─── Public API: playChunk ─────────────────────────────────────────────
  const playChunk = useCallback(async (base64: string) => {
    // Thử unlock trước (no-op nếu đã unlock)
    try {
      const ctx = getContext();
      if (ctx.state === "suspended") {
        // Không await — gọi non-blocking để không block hàm này
        ctx.resume().then(() => {
          if (ctx.state === "running") {
            isUnlockedRef.current = true;
          }
        });
      }

      if (ctx.state !== "running") {
        // Chưa unlock → buffer lại, phát sau khi user gesture
        console.log("⏸️ AudioContext suspended, buffering chunk");
        pendingChunksRef.current.push(base64);
        return;
      }

      isUnlockedRef.current = true;
      setIsUnlocked(true);
      await _playChunkInternal(ctx, base64);
    } catch (err) {
      console.error("❌ playChunk error:", err);
    }
  }, []);

  // ─── Public API: stopPlayback — chỉ dừng audio đang phát, giữ context ─
  // Dùng khi interrupt: không reset isUnlocked, không đóng AudioContext
  const stopPlayback = useCallback(() => {
    if (stopDebounceRef.current) {
      clearTimeout(stopDebounceRef.current);
      stopDebounceRef.current = null;
    }
    pendingChunksRef.current = [];
    nextStartTimeRef.current = 0;

    activeSourcesRef.current.forEach((s) => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    activeSourcesRef.current = [];
    setIsPlaying(false);
  }, []);

  // ─── Public API: stop — cleanup hoàn toàn (dùng khi unmount) ─────────
  const stop = useCallback(() => {
    stopPlayback();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isUnlockedRef.current = false;
    setIsUnlocked(false);
  }, [stopPlayback]);

  return { playChunk, stopPlayback, stop, isPlaying, isUnlocked, unlockAndFlush };
}
