"use client";

import React, { useRef, useEffect, useState } from "react";
import { TranscriptMessage, VoiceState, MockOrder } from "@/types";
import { ArrowUp, PhoneOff, Mic, AlertCircle, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { VoiceOrb } from "@/components/VoiceOrb";
import { VoiceDiagnostic } from "@/lib/services/voiceService";

interface ActiveConversationViewProps {
  voiceState: VoiceState;
  transcript: TranscriptMessage[];
  currentSpeakerText: string;
  errorMessage: string | null;
  activeOrderCard?: MockOrder | null;
  voiceDiagnostic?: VoiceDiagnostic | null;
  onEndCall: () => void;
  onSendMessage: (text: string) => Promise<void>;
  isSpeechSupported: boolean;
}

export const ActiveConversationView: React.FC<ActiveConversationViewProps> = ({
  voiceState,
  transcript,
  currentSpeakerText,
  errorMessage,
  voiceDiagnostic,
  onEndCall,
  onSendMessage,
  isSpeechSupported,
}) => {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, currentSpeakerText, voiceState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || voiceState === "thinking") return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  // State label & description
  const getStateMeta = () => {
    switch (voiceState) {
      case "listening":
        return {
          title: "Listening",
          desc: currentSpeakerText ? `"${currentSpeakerText}"` : "Speak naturally into your microphone",
          badgeColor: "bg-[#DCE7D8] text-[#29372D]",
        };
      case "thinking":
        return {
          title: "Thinking",
          desc: "Consulting Aura policies & order lookup...",
          badgeColor: "bg-[#C9D4B5] text-[#29372D]",
        };
      case "speaking":
      case "responding":
        return {
          title: "Responding",
          desc: "Aria is speaking aloud. Mic paused to avoid feedback.",
          badgeColor: "bg-[#6B8068] text-white",
        };
      case "error":
        return {
          title: "Error",
          desc: errorMessage || "Please check browser mic access",
          badgeColor: "bg-rose-100 text-rose-800",
        };
      case "ended":
        return {
          title: "Call ended",
          desc: "Generating call summary...",
          badgeColor: "bg-stone-200 text-[#29372D]",
        };
      case "idle":
      default:
        return {
          title: "Connected",
          desc: "Conversation in progress",
          badgeColor: "bg-[#DCE7D8] text-[#29372D]",
        };
    }
  };

  const stateMeta = getStateMeta();

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col min-h-[580px] bg-white/70 backdrop-blur-md rounded-3xl border border-[#DCE7D8] shadow-[0_10px_35px_rgba(41,55,45,0.04)] overflow-hidden transition-all">
      {/* Top Bar with Voice Orb, Status & End Call */}
      <div className="px-6 py-5 border-b border-[#DCE7D8]/70 bg-gradient-to-b from-[#FAF8F2] to-white/60 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <VoiceOrb state={voiceState} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-semibold text-lg text-[#29372D]">
                Aria
              </span>
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full transition-colors ${stateMeta.badgeColor}`}
              >
                {stateMeta.title}
              </span>
            </div>
            <p className="text-xs text-[#29372D]/70 mt-0.5 max-w-xs truncate">
              {stateMeta.desc}
            </p>
            {voiceDiagnostic && (
              <span className="text-[10px] text-[#29372D]/50 block mt-0.5">
                Voice: {voiceDiagnostic.name} ({voiceDiagnostic.lang})
              </span>
            )}
          </div>
        </div>

        {/* Prominent End Call button */}
        <button
          onClick={onEndCall}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-medium border border-rose-200/80 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>End call</span>
        </button>
      </div>

      {/* Browser speech support notice if needed */}
      {!isSpeechSupported && (
        <div className="bg-amber-50/80 border-b border-amber-200/60 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>Speech Recognition is best supported in Chrome or Edge. You can also chat smoothly using the text input below.</span>
        </div>
      )}

      {/* Conversation Transcript Stream */}
      <div
        ref={scrollRef}
        className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[380px] bg-transparent"
      >
        {transcript.map((msg) => {
          const isAria = msg.sender === "aria";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isAria ? "items-start" : "items-end"} transition-all`}
            >
              <span className="text-[10px] font-medium tracking-wide uppercase text-[#29372D]/40 mb-1 px-1">
                {isAria ? "Aria" : "You"} • {msg.timestamp}
              </span>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                  isAria
                    ? "bg-[#FAF8F2] text-[#29372D] border border-[#DCE7D8] rounded-tl-sm"
                    : "bg-[#6B8068] text-white rounded-tr-sm"
                }`}
              >
                {msg.text}
              </div>

              {/* Render Order Card if this turn retrieved an order */}
              {isAria && msg.order && (
                <div className="mt-2 w-full max-w-[85%] sm:max-w-[75%] bg-white rounded-2xl p-4 border border-[#DCE7D8] shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DCE7D8]/60">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#6B8068]" />
                      <span className="font-mono font-bold text-xs text-[#29372D]">
                        {msg.order.order_id}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        msg.order.status === "Out for Delivery"
                          ? "bg-amber-100 text-amber-800"
                          : msg.order.status === "Delivered"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-[#DCE7D8] text-[#29372D]"
                      }`}
                    >
                      {msg.order.status}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-xs text-[#29372D]">
                    <div className="flex justify-between">
                      <span className="text-[#29372D]/60">Product</span>
                      <span className="font-medium text-right">{msg.order.product_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#29372D]/60">Customer</span>
                      <span>{msg.order.customer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#29372D]/60">Amount</span>
                      <span>₹{msg.order.amount}</span>
                    </div>

                    {msg.order.courier && msg.order.tracking_id && (
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B8068] font-medium">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" /> {msg.order.courier}
                        </span>
                        <span className="font-mono">ID: {msg.order.tracking_id}</span>
                      </div>
                    )}

                    {msg.order.expected_delivery && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-800 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Expected: {msg.order.expected_delivery}</span>
                      </div>
                    )}

                    {msg.order.delivery_date_description && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{msg.order.delivery_date_description}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* In-flight interim user transcription */}
        {voiceState === "listening" && currentSpeakerText && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[#6B8068] mb-1 px-1 flex items-center gap-1">
              <Mic className="w-3 h-3 animate-pulse" /> Listening...
            </span>
            <div className="max-w-[80%] rounded-2xl px-5 py-3 text-sm italic bg-[#DCE7D8]/40 text-[#29372D]/70 border border-[#C9D4B5]/60 rounded-tr-sm">
              {currentSpeakerText}
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {voiceState === "thinking" && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[#29372D]/40 mb-1 px-1">
              Aria
            </span>
            <div className="bg-[#FAF8F2] border border-[#DCE7D8] rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2 text-xs text-[#29372D]/70">
              <span className="w-2 h-2 rounded-full bg-[#6B8068] animate-ping" />
              <span>Thinking & checking order records...</span>
            </div>
          </div>
        )}
      </div>

      {/* Secondary text input for customers unable to speak or in noisy areas */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-[#DCE7D8]/70 bg-[#FAF8F2]/60 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          disabled={voiceState === "thinking"}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={voiceState === "thinking" ? "Aria is thinking..." : "Type here if you prefer not to speak (e.g., Where is ORD-101?)..."}
          className="flex-1 bg-white border border-[#DCE7D8] rounded-full px-5 py-2.5 text-xs text-[#29372D] placeholder-[#29372D]/40 focus:outline-none focus:ring-1 focus:ring-[#6B8068] focus:border-[#6B8068] disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || voiceState === "thinking"}
          className="w-9 h-9 rounded-full bg-[#6B8068] hover:bg-[#576A54] disabled:opacity-40 text-white flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
          title="Send message"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
