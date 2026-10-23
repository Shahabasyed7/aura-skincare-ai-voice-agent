"use client";

import React, { useRef, useEffect, useState } from "react";
import { TranscriptMessage } from "@/types";
import { Send, User, Sparkles } from "lucide-react";

interface TranscriptProps {
  transcript: TranscriptMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isCallActive: boolean;
}

export const Transcript: React.FC<TranscriptProps> = ({
  transcript,
  onSendMessage,
  isCallActive,
}) => {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-700" />
          <h3 className="font-semibold text-stone-800 text-sm">Live Call Transcript</h3>
        </div>
        <span className="text-xs text-stone-400 font-mono">
          {transcript.length} {transcript.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[260px] max-h-[380px]">
        {transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-stone-400 text-center">
            <p className="text-sm">No conversation turns yet.</p>
            <p className="text-xs mt-1 text-stone-400">Click Start Call to speak or type a test message below.</p>
          </div>
        ) : (
          transcript.map((msg) => {
            const isAria = msg.sender === "aria";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAria ? "justify-start" : "justify-end"}`}
              >
                {isAria && (
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 shadow-sm">
                    A
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    isAria
                      ? "bg-stone-100 text-stone-900 rounded-tl-sm"
                      : "bg-emerald-800 text-white rounded-tr-sm shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
                      {isAria ? "Aria (Aura CX)" : "Customer"}
                    </span>
                    <span className="text-[10px] opacity-60 font-mono">{msg.timestamp}</span>
                  </div>
                  <p className="leading-relaxed text-sm">{msg.text}</p>
                </div>
                {!isAria && (
                  <div className="w-7 h-7 rounded-full bg-stone-300 text-stone-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-stone-100 bg-stone-50 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isCallActive ? "Type here if speech recognition is paused..." : "Type a customer message (e.g. Where is ORD-101?)..."}
          className="flex-1 text-sm bg-white border border-stone-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-700 text-stone-800"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Send className="w-4 h-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
