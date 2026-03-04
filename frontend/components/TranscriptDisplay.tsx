"use client";

import { useEffect, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
};

type Props = {
  messages: Message[];
  isListening?: boolean;
  currentSpeech?: string;
};

export default function TranscriptDisplay({ 
  messages, 
  isListening = false,
  currentSpeech = ""
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentSpeech]);

  if (messages.length === 0 && !currentSpeech) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto" ref={scrollRef}>
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`mb-4 ${
            msg.role === "user" ? "text-right" : "text-left"
          }`}
        >
          <div
            className={`inline-block max-w-[80%] px-4 py-2 rounded-lg ${
              msg.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-gray-200"
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            <p className="text-xs opacity-60 mt-1">
              {msg.timestamp.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}

      {/* Current speech (live) */}
      {currentSpeech && (
        <div className="text-left mb-4">
          <div className="inline-block max-w-[80%] px-4 py-2 rounded-lg bg-slate-700 text-gray-200">
            <p className="text-sm whitespace-pre-wrap">{currentSpeech}</p>
            {isListening && (
              <div className="flex items-center gap-1 mt-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
