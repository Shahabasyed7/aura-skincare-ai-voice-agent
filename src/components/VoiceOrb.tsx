"use client";

import React from "react";
import { VoiceState } from "@/types";

interface VoiceOrbProps {
  state: VoiceState;
  size?: "lg" | "md";
  onClick?: () => void;
  interactive?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  size = "lg",
  onClick,
  interactive = false,
}) => {
  const isLarge = size === "lg";
  const orbDimension = isLarge ? "w-44 h-44 sm:w-52 sm:h-52" : "w-28 h-28 sm:w-32 sm:h-32";
  const glowDimension = isLarge ? "w-60 h-60 sm:w-72 sm:h-72" : "w-40 h-40 sm:w-44 sm:h-44";

  // Dynamic animations & tints based on Aria's voice state
  const getOrbStyles = () => {
    switch (state) {
      case "listening":
        return {
          gradient: "from-[#C9D4B5] via-[#DCE7D8] to-[#86A385]",
          shadow: "shadow-[0_0_50px_rgba(201,212,181,0.6)]",
          animation: "animate-orb-listen",
          ringColor: "border-[#6B8068]/40",
          glowOpacity: "opacity-75",
        };
      case "thinking":
        return {
          gradient: "from-[#DCE7D8] via-[#C9D4B5] to-[#A8BFA7]",
          shadow: "shadow-[0_0_45px_rgba(220,231,216,0.6)]",
          animation: "animate-orb-think",
          ringColor: "border-[#A8BFA7]/40",
          glowOpacity: "opacity-60",
        };
      case "speaking":
        return {
          gradient: "from-[#6B8068] via-[#86A385] to-[#DCE7D8]",
          shadow: "shadow-[0_0_65px_rgba(107,128,104,0.55)]",
          animation: "animate-orb-speak",
          ringColor: "border-[#6B8068]/60",
          glowOpacity: "opacity-90",
        };
      case "error":
        return {
          gradient: "from-[#E3D1C8] via-[#DCE7D8] to-[#C9D4B5]",
          shadow: "shadow-[0_0_35px_rgba(227,209,200,0.5)]",
          animation: "animate-pulse-subtle",
          ringColor: "border-[#E3D1C8]/60",
          glowOpacity: "opacity-50",
        };
      case "idle":
      default:
        return {
          gradient: "from-[#DCE7D8] via-[#E5ECE5] to-[#C9D4B5]",
          shadow: "shadow-[0_0_40px_rgba(220,231,216,0.5)]",
          animation: "animate-orb-breathe",
          ringColor: "border-[#DCE7D8]/60",
          glowOpacity: "opacity-45",
        };
    }
  };

  const orb = getOrbStyles();

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={`relative flex items-center justify-center select-none ${
        interactive ? "cursor-pointer group" : ""
      }`}
    >
      {/* Outer ambient glow */}
      <div
        className={`absolute ${glowDimension} rounded-full bg-gradient-to-tr from-[#DCE7D8]/50 via-[#C9D4B5]/30 to-[#E5ECE5]/40 blur-2xl transition-all duration-1000 ${orb.glowOpacity} pointer-events-none`}
      />

      {/* Subtle outer delicate border ring */}
      <div
        className={`absolute ${isLarge ? "w-56 h-56 sm:w-64 sm:h-64" : "w-36 h-36"} rounded-full border border-dashed ${
          orb.ringColor
        } transition-all duration-700 pointer-events-none animate-spin [animation-duration:45s]`}
      />

      {/* Inner tactile botanical sphere */}
      <div
        className={`relative ${orbDimension} rounded-full bg-gradient-to-br ${orb.gradient} ${orb.shadow} ${orb.animation} transition-all duration-700 flex items-center justify-center p-1.5 backdrop-blur-md`}
      >
        {/* Soft satin reflective overlay */}
        <div className="w-full h-full rounded-full bg-gradient-to-t from-transparent via-white/20 to-white/60 flex items-center justify-center">
          {/* Subtle concentric sound wave ripples when speaking or listening */}
          {(state === "listening" || state === "speaking") && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-1 bg-[#29372D]/60 rounded-full h-3 animate-pulse" />
              <span className="w-1 bg-[#29372D]/80 rounded-full h-6 animate-pulse [animation-delay:150ms]" />
              <span className="w-1 bg-[#29372D] rounded-full h-8 animate-pulse [animation-delay:300ms]" />
              <span className="w-1 bg-[#29372D]/80 rounded-full h-6 animate-pulse [animation-delay:450ms]" />
              <span className="w-1 bg-[#29372D]/60 rounded-full h-3 animate-pulse [animation-delay:600ms]" />
            </div>
          )}

          {state === "thinking" && (
            <div className="w-6 h-6 rounded-full border-2 border-[#29372D]/30 border-t-[#29372D] animate-spin" />
          )}

          {state === "idle" && (
            <div className="w-2.5 h-2.5 rounded-full bg-[#6B8068]/50 group-hover:scale-125 transition-transform" />
          )}
        </div>
      </div>
    </div>
  );
};
