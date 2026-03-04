import { useState, useRef, useCallback } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const chunkCountRef = useRef(0);

  const start = useCallback(async (onChunk: (base64: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,  // Loại bỏ echo
          noiseSuppression: true,  // Loại bỏ noise
          autoGainControl: true,   // Tự động điều chỉnh âm lượng
        }
      });
      
      streamRef.current = stream;
      
      // Create AudioContext for PCM conversion
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode to get raw PCM data
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        // Log every 10 chunks
        if (chunkCountRef.current % 10 === 0) {
          console.log(`🎙️ Audio chunk #${chunkCountRef.current}: ${pcmData.length} samples`);
        }
        chunkCountRef.current++;
        
        onChunk(base64);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      isRecordingRef.current = true;
      setIsRecording(true);
      console.log("🎤 Recording started (PCM 16kHz mono)");
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Không thể truy cập microphone. Vui lòng cấp quyền.");
    }
  }, []);

  const stop = useCallback(() => {
    console.log("🛑 Stopping recording");
    
    isRecordingRef.current = false;
    chunkCountRef.current = 0;  // Reset counter
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  // VAD Mode: Continuous streaming (luôn gửi audio, Gemini VAD tự detect)
  const startContinuous = useCallback(
    async (onChunk: (base64: string, rms: number) => void) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = stream;
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);

        // Buffer size must be power of 2: 2048 samples = 128ms @ 16kHz
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        // LUÔN stream, không cần check isRecordingRef
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          let energy = 0;

          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            energy += s * s;
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          const rms = Math.sqrt(energy / inputData.length);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          onChunk(base64, rms);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        setIsRecording(true);
        console.log("🎤 Continuous streaming started (VAD mode, 2048 buffer)");
      } catch (error) {
        console.error("Failed to start continuous recording:", error);
        alert("Không thể truy cập microphone. Vui lòng cấp quyền.");
      }
    },
    []
  );

  return { start, stop, startContinuous, isRecording };
}
