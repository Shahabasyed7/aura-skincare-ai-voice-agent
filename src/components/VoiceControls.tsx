"use client";

import React from "react";
import { VoiceState } from "@/types";
import { Mic, PhoneCall, PhoneOff, AlertCircle } from "lucide-react";

interface VoiceControlsProps {
  voiceState: VoiceState;
  isCallActive: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  isSpeechSupported: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  voiceState,
  isCallActive,
  onStartCall,
  onEndCall,
  isSpeechSupported,
}) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl shadow-sm border border-stone-200">
      <div className="relative flex items-center justify-center">
        {/* Animated aura ring based on voiceState */}
        {isCallActive && (
          <span
            className={`absolute w-24 h-24 rounded-full transition-all duration-700 pointer-events-none ${
              voiceState === "speaking"
                ? "bg-emerald-400/30 scale-125 animate-ping"
                : voiceState === "listening"
                ? "bg-emerald-500/20 scale-110 animate-pulse"
                : voiceState === "thinking"
                ? "bg-amber-400/20 scale-110 animate-pulse"
                : "bg-stone-200"
            }`}
          />
        )}

        {!isCallActive ? (
          <button
            onClick={onStartCall}
            className="relative z-10 flex items-center gap-3 px-8 py-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-full font-medium shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <PhoneCall className="w-5 h-5 animate-bounce" />
            <span>Start Voice Call</span>
          </button>
        ) : (
          <button
            onClick={onEndCall}
            className="relative z-10 flex items-center gap-3 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-medium shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <PhoneOff className="w-5 h-5" />
            <span>End Call</span>
          </button>
        )}
      </div>

      {!isSpeechSupported && (
        <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Speech Recognition is best experienced on Google Chrome or Edge. Fallback text input is also supported below.</span>
        </div>
      )}
    </div>
  );
};
