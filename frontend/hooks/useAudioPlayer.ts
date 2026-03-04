import { useCallback, useRef, useState } from "react";

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const getAudioContext = () => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;
    }
    return audioContextRef.current;
  };

  const playChunk = useCallback(async (base64: string) => {
    try {
      const ctx = getAudioContext();

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Decode base64 → binary
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert raw PCM Int16 → Float32
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // Create AudioBuffer
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      // Schedule playback (queue chunks seamlessly)
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      const startTime = Math.max(nextStartTimeRef.current, currentTime);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
      setIsPlaying(true);

      // Track active sources
      activeSourcesRef.current.push(source);

      source.onended = () => {
        // Remove from active sources
        const index = activeSourcesRef.current.indexOf(source);
        if (index > -1) {
          activeSourcesRef.current.splice(index, 1);
        }
        
        // Only set isPlaying to false if:
        // 1. No more active sources
        // 2. AND no more chunks scheduled (nextStartTime has passed)
        setTimeout(() => {
          const ctx = audioContextRef.current;
          if (ctx && activeSourcesRef.current.length === 0 && nextStartTimeRef.current <= ctx.currentTime + 0.1) {
            console.log("🔇 Audio playback finished");
            setIsPlaying(false);
          }
        }, 100);
      };

      console.log(`✅ Playing PCM chunk: ${float32.length} samples, ${audioBuffer.duration.toFixed(2)}s`);
    } catch (error) {
      console.error("❌ Failed to play audio chunk:", error);
    }
  }, []);

  const stop = useCallback(() => {
    console.log("🛑 Stopping all audio");
    
    // Stop all active sources
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    });
    activeSourcesRef.current = [];
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  return { playChunk, stop, isPlaying };
}
