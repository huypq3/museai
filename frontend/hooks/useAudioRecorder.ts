import { useState, useRef, useCallback } from "react";

type AutoStopOptions = {
  onAutoStop?: (reason: "silence" | "no_speech") => void;
  silenceMs?: number;
  maxNoSpeechMs?: number;
  voiceThreshold?: number;
};

const WORKLET_CODE = `
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._targetSamples = 640; // 40ms @ 16kHz
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) this._buffer.push(input[i]);
    while (this._buffer.length >= this._targetSamples) {
      this.port.postMessage(new Float32Array(this._buffer.splice(0, this._targetSamples)));
    }
    return true;
  }
}
registerProcessor('pcm-processor', PcmProcessor);
`;

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    result[i] = idx + 1 < buffer.length
      ? buffer[idx] * (1 - frac) + buffer[idx + 1] * frac
      : buffer[idx];
  }
  return result;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const chunkCountRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const hasDetectedVoiceRef = useRef(false);
  const autoStoppedRef = useRef(false);

  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(slice));
    }
    return btoa(binary);
  };

  const start = useCallback(async (onChunk: (base64: string) => void, options?: AutoStopOptions) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,  // Reduce echo
          noiseSuppression: true,  // Reduce background noise
          autoGainControl: true,   // Auto-adjust microphone gain
        }
      });
      
      streamRef.current = stream;
      
      // Create AudioContext first, then read actual device sample rate
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const deviceSampleRate = audioContext.sampleRate;
      
      const source = audioContext.createMediaStreamSource(stream);
      const silenceMs = options?.silenceMs ?? 1300;
      const maxNoSpeechMs = options?.maxNoSpeechMs ?? 2800;
      const voiceThreshold = options?.voiceThreshold ?? 0;

      const processFrame = (floatData: Float32Array) => {
        if (!isRecordingRef.current) return;

        const mono16k = downsample(floatData, deviceSampleRate, 16000);
        let energy = 0;
        const pcmData = new Int16Array(mono16k.length);
        for (let i = 0; i < mono16k.length; i++) {
          const s = Math.max(-1, Math.min(1, mono16k[i]));
          energy += s * s;
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const rms = mono16k.length > 0 ? Math.sqrt(energy / mono16k.length) : 0;
        const now = Date.now();
        if (rms >= voiceThreshold) {
          lastVoiceAtRef.current = now;
          hasDetectedVoiceRef.current = true;
        }

        const base64 = bytesToBase64(new Uint8Array(pcmData.buffer));
        if (chunkCountRef.current % 10 === 0) {
          console.log(`🎙️ Audio chunk #${chunkCountRef.current}: ${pcmData.length} samples`);
        }
        chunkCountRef.current++;
        onChunk(base64);

        if (autoStoppedRef.current) return;

        if (
          hasDetectedVoiceRef.current &&
          now - lastVoiceAtRef.current >= silenceMs
        ) {
          autoStoppedRef.current = true;
          console.log(`⏱️ Auto-stop: silence ${silenceMs}ms`);
          options?.onAutoStop?.("silence");
          return;
        }

        if (
          !hasDetectedVoiceRef.current &&
          now - recordingStartedAtRef.current >= maxNoSpeechMs
        ) {
          autoStoppedRef.current = true;
          console.log(`⏱️ Auto-stop: no speech ${maxNoSpeechMs}ms`);
          options?.onAutoStop?.("no_speech");
        }
      };

      const supportsWorklet =
        typeof AudioWorkletNode !== "undefined" &&
        typeof audioContext.audioWorklet !== "undefined";

      if (supportsWorklet) {
        const workletUrl = URL.createObjectURL(
          new Blob([WORKLET_CODE], { type: "application/javascript" })
        );
        try {
          await audioContext.audioWorklet.addModule(workletUrl);
        } finally {
          URL.revokeObjectURL(workletUrl);
        }

        const workletNode = new AudioWorkletNode(audioContext, "pcm-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
        });
        workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
          const frame = event.data;
          if (!frame) return;
          processFrame(frame);
        };

        processorRef.current = workletNode;
        source.connect(workletNode);
      } else {
        console.warn("AudioWorklet is not supported, falling back to ScriptProcessorNode");
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          processFrame(e.inputBuffer.getChannelData(0));
        };
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioContext.destination);
      }
      
      isRecordingRef.current = true;
      hasDetectedVoiceRef.current = false;
      autoStoppedRef.current = false;
      recordingStartedAtRef.current = Date.now();
      lastVoiceAtRef.current = recordingStartedAtRef.current;
      setIsRecording(true);
      console.log("🎤 Recording started (PCM 16kHz mono)");
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Cannot access microphone. Please grant permission.");
    }
  }, []);

  const stop = useCallback(() => {
    console.log("🛑 Stopping recording");
    
    isRecordingRef.current = false;
    chunkCountRef.current = 0;  // Reset counter
    hasDetectedVoiceRef.current = false;
    autoStoppedRef.current = false;
    
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

  // VAD mode: continuous streaming (always send audio, Gemini detects activity)
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

        // Always stream in VAD mode; no isRecordingRef gate needed.
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
          const base64 = bytesToBase64(new Uint8Array(pcmData.buffer));
          onChunk(base64, rms);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        setIsRecording(true);
        console.log("🎤 Continuous streaming started (VAD mode, 2048 buffer)");
      } catch (error) {
        console.error("Failed to start continuous recording:", error);
        alert("Cannot access microphone. Please grant permission.");
      }
    },
    []
  );

  return { start, stop, startContinuous, isRecording };
}
