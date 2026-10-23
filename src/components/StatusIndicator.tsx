"use client";

import React from "react";
import { VoiceState } from "@/types";
import { Mic, Volume2, Brain, AlertOctagon, Coffee } from "lucide-react";

interface StatusIndicatorProps {
  state: VoiceState;
  currentSpeakerText?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ state, currentSpeakerText }) => {
  const getBadgeConfig = () => {
    switch (state) {
      case "listening":
        return {
          bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          icon: <Mic className="w-4 h-4 text-emerald-600 animate-pulse" />,
          label: "Listening...",
          subtext: currentSpeakerText ? `"${currentSpeakerText}"` : "Speak into your microphone",
        };
      case "thinking":
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          icon: <Brain className="w-4 h-4 text-amber-600 animate-spin" />,
          label: "Thinking...",
          subtext: "Verifying Aura policies & retrieving details",
        };
      case "speaking":
        return {
          bg: "bg-teal-50 border-teal-200 text-teal-800",
          icon: <Volume2 className="w-4 h-4 text-teal-600 animate-bounce" />,
          label: "Speaking",
          subtext: "Aria is responding to you",
        };
      case "error":
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-800",
          icon: <AlertOctagon className="w-4 h-4 text-rose-600" />,
          label: "Connection Notice",
          subtext: "Please check your mic permissions or network",
        };
      case "idle":
      default:
        return {
          bg: "bg-stone-50 border-stone-200 text-stone-600",
          icon: <Coffee className="w-4 h-4 text-stone-400" />,
          label: "Agent Idle",
          subtext: "Click 'Start Voice Call' to speak with Aria",
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${badge.bg} transition-all`}>
      <div className="flex-shrink-0">{badge.icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold tracking-wide uppercase">{badge.label}</span>
        <span className="text-xs text-stone-600 truncate max-w-xs md:max-w-md">{badge.subtext}</span>
      </div>
    </div>
  );
};
