"use client";

import React, { useState } from "react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { VoiceOrb } from "@/components/VoiceOrb";
import { ActiveConversationView } from "@/components/ActiveConversationView";
import { CallSummaryView } from "@/components/CallSummaryView";
import { EvaluatorDrawer } from "@/components/EvaluatorDrawer";
import {
  Sparkles,
  SlidersHorizontal,
  AlertCircle,
  Package,
  RotateCcw,
  Truck,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";

export default function HomePage() {
  const {
    voiceState,
    isCallActive,
    transcript,
    currentSpeakerText,
    errorMessage,
    activeOrderCard,
    callSummary,
    voiceDiagnostic,
    startCall,
    endCall,
    sendTextMessage,
    isSpeechSupported,
    clearError,
  } = useVoiceAgent();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Quick helper to start a call and inject a chosen prompt
  const handleStartWithPrompt = (message: string) => {
    if (!isCallActive) {
      startCall();
      setTimeout(() => {
        sendTextMessage(message);
      }, 400);
    } else {
      sendTextMessage(message);
    }
  };

  const handleCopyOrderId = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const canonicalOrders = [
    {
      id: "ORD-101",
      customer: "Priya Sharma",
      product: "Vitamin C Serum 30ml",
      amount: "₹699",
      status: "Out for Delivery",
      courier: "BlueDart (BD-982103)",
      eta: "by 6 PM today",
      prompt: "Where is my order ORD-101?",
    },
    {
      id: "ORD-102",
      customer: "Rahul Verma",
      product: "Hydrating Sunscreen SPF 50",
      amount: "₹499",
      status: "Delivered",
      courier: "Delhivery (DL-441029)",
      eta: "Delivered 14 days ago (Return window closed)",
      prompt: "Can I return order ORD-102?",
    },
    {
      id: "ORD-103",
      customer: "Ananya Patel",
      product: "Green Tea Face Wash + Toner",
      amount: "₹850",
      status: "Processing",
      courier: "Awaiting dispatch",
      eta: "Ordered 3 hours ago (Eligible to cancel)",
      prompt: "I want to cancel order ORD-103",
    },
  ];

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

          <div className="flex items-center gap-2">
            {/* Discreet Evaluator Testing Tools Link */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-[#DCE7D8]/60 border border-[#DCE7D8] text-xs font-medium text-[#29372D]/80 hover:text-[#29372D] transition-all"
              title="Open evaluator testing drawer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B8068]" />
              <span>Testing tools</span>
            </button>
          </div>
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col items-center justify-center">
        {/* VIEW B: Active Call in Progress */}
        {isCallActive ? (
          <ActiveConversationView
            voiceState={voiceState}
            transcript={transcript}
            currentSpeakerText={currentSpeakerText}
            errorMessage={errorMessage}
            activeOrderCard={activeOrderCard}
            voiceDiagnostic={voiceDiagnostic}
            onEndCall={endCall}
            onSendMessage={sendTextMessage}
            isSpeechSupported={isSpeechSupported}
          />
        ) : callSummary ? (
          /* VIEW C: Call Completed Summary */
          <CallSummaryView
            summary={callSummary}
            transcript={transcript}
            onNewConversation={startCall}
          />
        ) : (
          /* VIEW A: Clean Home / Voice Concierge Landing Screen */
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center space-y-7 animate-fade-in">
            {/* Soft Botanical Tagline */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DCE7D8]/60 border border-[#C9D4B5]/60 text-xs text-[#29372D] tracking-wide font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#6B8068]" />
              <span>Voice Concierge · Aria</span>
            </div>

            {/* Main Headline & Intro */}
            <div className="space-y-2">
              <h1 className="font-serif font-normal text-4xl sm:text-5xl text-[#29372D] tracking-tight leading-[1.15]">
                Your skincare, answered.
              </h1>
              <p className="text-sm sm:text-base text-[#29372D]/70 max-w-md mx-auto leading-relaxed">
                Meet Aria, your personal voice concierge. Inquire about deliveries, live order tracking, or return guidance in natural English.
              </p>
            </div>

            {/* Botanical Voice Orb */}
            <div className="py-1">
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

            {/* Section 8: Visible Test-Orders Panel on the main page */}
            <div className="w-full text-left pt-2">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#29372D]/60">
                    Canonical Test Orders
                  </h3>
                  <span className="text-[11px] text-[#29372D]/50">
                    Simulated records for testing deterministic lookup & policies
                  </span>
                </div>
                <span className="text-[10px] bg-[#DCE7D8]/60 text-[#29372D] px-2 py-0.5 rounded-full font-medium">
                  Click to test or copy ID
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {canonicalOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => handleStartWithPrompt(ord.prompt)}
                    className="p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-[#DCE7D8] hover:border-[#6B8068]/60 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#DCE7D8]/50">
                        <span className="font-mono font-bold text-xs text-[#29372D] group-hover:text-[#6B8068] transition-colors">
                          {ord.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleCopyOrderId(e, ord.id)}
                            title="Copy Order ID"
                            className="p-1 rounded-md hover:bg-[#FAF8F2] text-[#29372D]/60 hover:text-[#29372D]"
                          >
                            {copiedOrderId === ord.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <span
                            className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                              ord.status === "Out for Delivery"
                                ? "bg-amber-100 text-amber-800"
                                : ord.status === "Delivered"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-[#DCE7D8] text-[#29372D]"
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 space-y-1 text-xs">
                        <p className="font-medium text-[#29372D] truncate">{ord.product}</p>
                        <p className="text-[11px] text-[#29372D]/60 truncate">
                          {ord.customer} · {ord.amount}
                        </p>
                        <p className="text-[10px] text-[#29372D]/70 font-mono truncate">
                          {ord.courier}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#DCE7D8]/40 flex items-center justify-between text-[11px] text-[#6B8068] font-medium">
                      <span className="text-[10px] text-[#29372D]/60">{ord.eta}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">Test →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Elegant Support Categories */}
            <div className="w-full pt-2">
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

      {/* Minimal Aesthetic Customer-Facing Footer */}
      <footer className="border-t border-[#DCE7D8]/50 py-5 bg-[#FAF8F2]/60">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#29372D]/60 gap-2">
          <span>Aura Skincare India · Personalised care, naturally.</span>
          <div className="flex items-center gap-2">
            <span>© 2026 Aura Skincare. All rights reserved.</span>
            <span>·</span>
            <a
              href="https://shahaba-ai-portfolio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Shahaba Syed portfolio"
              className="text-[#29372D]/70 hover:text-[#18392B] underline decoration-[#18392B]/30 hover:decoration-[#18392B] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#18392B] rounded-sm"
            >
              Shahaba Syed
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
