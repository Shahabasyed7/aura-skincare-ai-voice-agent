"use client";

import React, { useState } from "react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { VoiceOrb } from "@/components/VoiceOrb";
import { ActiveConversationView } from "@/components/ActiveConversationView";
import { CallSummaryView } from "@/components/CallSummaryView";
import { EvaluatorDrawer } from "@/components/EvaluatorDrawer";
import { Sparkles, SlidersHorizontal, AlertCircle, Package, RotateCcw, Truck, HelpCircle } from "lucide-react";

export default function HomePage() {
  const {
    voiceState,
    isCallActive,
    transcript,
    currentSpeakerText,
    errorMessage,
    callSummary,
    startCall,
    endCall,
    sendTextMessage,
    isSpeechSupported,
    clearError,
  } = useVoiceAgent();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Quick helper to start a call and inject a chosen prompt
  const handleStartWithPrompt = (message: string) => {
    if (!isCallActive) {
      startCall();
      setTimeout(() => {
        sendTextMessage(message);
      }, 300);
    } else {
      sendTextMessage(message);
    }
  };

  const supportCategories = [
    {
      title: "Track My Order",
      description: "Live delivery status & courier tracking",
      icon: <Package className="w-4 h-4 text-[#6B8068]" />,
      prompt: "Where is my order ORD-101?",
    },
    {
      title: "Returns & Refunds",
      description: "7-day return policy & damaged item care",
      icon: <RotateCcw className="w-4 h-4 text-[#6B8068]" />,
      prompt: "What is your return policy for delivered products?",
    },
    {
      title: "Shipping & Delivery",
      description: "Free shipping rules, COD & timelines",
      icon: <Truck className="w-4 h-4 text-[#6B8068]" />,
      prompt: "How much is shipping and what are the delivery times?",
    },
    {
      title: "Product Support",
      description: "Organic formulations & skincare advice",
      icon: <HelpCircle className="w-4 h-4 text-[#6B8068]" />,
      prompt: "Can you tell me about the Vitamin C Serum ingredients?",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#29372D] flex flex-col justify-between selection:bg-[#DCE7D8] selection:text-[#29372D]">
      {/* Brand Minimal Header */}
      <header className="border-b border-[#DCE7D8]/60 bg-[#FAF8F2]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-serif tracking-tight text-xl font-medium text-[#29372D]">
              Aura Skincare
            </span>
            <span className="text-[11px] text-[#29372D]/60 tracking-wider">
              Personalised care, naturally.
            </span>
          </div>

          {/* Discreet Evaluator Testing Tools Link */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-[#DCE7D8]/60 border border-[#DCE7D8] text-xs font-medium text-[#29372D]/80 hover:text-[#29372D] transition-all"
            title="Open evaluator testing tools"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B8068]" />
            <span>Testing tools</span>
          </button>
        </div>
      </header>

      {/* Global Error Notice if active */}
      {errorMessage && (
        <div className="max-w-md mx-auto mt-4 px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="text-[10px] font-semibold text-rose-700 hover:text-rose-900 uppercase"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dynamic Views: View A (Home), View B (Active Call), or View C (Summary) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col items-center justify-center">
        {/* VIEW B: Active Call in Progress */}
        {isCallActive ? (
          <ActiveConversationView
            voiceState={voiceState}
            transcript={transcript}
            currentSpeakerText={currentSpeakerText}
            errorMessage={errorMessage}
            onEndCall={endCall}
            onSendMessage={sendTextMessage}
            isSpeechSupported={isSpeechSupported}
          />
        ) : callSummary ? (
          /* VIEW C: Call Completed Summary */
          <CallSummaryView
            summary={callSummary}
            onNewConversation={startCall}
          />
        ) : (
          /* VIEW A: Clean Home / Voice Concierge Landing Screen */
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-8 animate-fade-in">
            {/* Soft Botanical Tagline */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DCE7D8]/60 border border-[#C9D4B5]/60 text-xs text-[#29372D] tracking-wide font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#6B8068]" />
              <span>Voice Concierge</span>
            </div>

            {/* Main Headline & Intro */}
            <div className="space-y-3">
              <h1 className="font-serif font-normal text-4xl sm:text-5xl text-[#29372D] tracking-tight leading-[1.15]">
                Your skincare, answered.
              </h1>
              <p className="text-sm sm:text-base text-[#29372D]/70 max-w-md mx-auto leading-relaxed">
                Meet Aria, your personal voice concierge. Inquire about deliveries, live order tracking, or return guidance in natural English.
              </p>
            </div>

            {/* Beautiful Softly Animated Botanical Voice Orb */}
            <div className="py-2">
              <VoiceOrb state="idle" size="lg" onClick={startCall} interactive />
            </div>

            {/* Prominent Primary Call Action Button */}
            <div className="space-y-2">
              <button
                onClick={startCall}
                className="px-8 py-3.5 rounded-full bg-[#6B8068] hover:bg-[#576A54] text-white text-sm font-medium tracking-wide shadow-[0_6px_20px_rgba(107,128,104,0.3)] transition-all hover:scale-[1.03] active:scale-[0.98]"
              >
                Start a conversation
              </button>
              <p className="text-xs text-[#29372D]/50 font-normal tracking-wide">
                Order tracking · Delivery · Returns
              </p>
            </div>

            {/* 4 Elegant Support Categories */}
            <div className="w-full pt-4">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#29372D]/40 block mb-3 text-center">
                Or select a topic to begin
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {supportCategories.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleStartWithPrompt(cat.prompt)}
                    className="p-3.5 rounded-2xl bg-white/60 hover:bg-white border border-[#DCE7D8] hover:border-[#6B8068]/50 transition-all text-xs flex items-start gap-3 shadow-xs hover:shadow-sm group text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#FAF8F2] group-hover:bg-[#DCE7D8]/60 flex items-center justify-center flex-shrink-0 transition-colors">
                      {cat.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-[#29372D] group-hover:text-[#6B8068] transition-colors">
                        {cat.title}
                      </h4>
                      <p className="text-[11px] text-[#29372D]/60 mt-0.5">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Evaluator Drawer for Testing Tools (View D) */}
      <EvaluatorDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onTestScenario={handleStartWithPrompt}
      />

      {/* Minimal Aesthetic Footer */}
      <footer className="border-t border-[#DCE7D8]/50 py-5 bg-[#FAF8F2]/60">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#29372D]/50 gap-2">
          <span>Aura Skincare India • Organic Botanical Science</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="hover:text-[#29372D] transition-colors underline underline-offset-2"
            >
              Evaluator Test Scenarios
            </button>
            <span>•</span>
            <span>Deterministic Policy Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
