"use client";

import React, { useState } from "react";
import { CallSummary, TranscriptMessage } from "@/types";
import { Check, Copy, ChevronDown, ChevronUp, RotateCcw, ShieldCheck, CheckCircle2, MessageSquare } from "lucide-react";

interface CallSummaryViewProps {
  summary: CallSummary | null;
  transcript?: TranscriptMessage[];
  onNewConversation: () => void;
}

export const CallSummaryView: React.FC<CallSummaryViewProps> = ({
  summary,
  transcript = [],
  onNewConversation,
}) => {
  const [copied, setCopied] = useState(false);
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);

  if (!summary) {
    return (
      <div className="w-full max-w-xl mx-auto p-8 bg-white/70 backdrop-blur rounded-3xl border border-[#DCE7D8] text-center shadow-sm">
        <p className="text-sm text-[#29372D]/60 mb-4">Generating your conversation summary...</p>
        <button
          onClick={onNewConversation}
          className="px-6 py-2.5 rounded-full bg-[#6B8068] text-white text-xs font-medium"
        >
          Start a new conversation
        </button>
      </div>
    );
  }

  const jsonString = JSON.stringify(summary, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case "ORDER_TRACKING":
        return "Order Tracking";
      case "ORDER_CANCELLATION":
        return "Order Cancellation";
      case "RETURN_REQUEST":
        return "Return Request";
      case "DAMAGED_PRODUCT":
        return "Damaged / Defective Item";
      case "SHIPPING_DELIVERY":
        return "Shipping & Delivery Policy";
      case "PAYMENT_COD":
        return "Cash on Delivery (COD)";
      case "PRODUCT_INQUIRY":
        return "Product Guidance";
      default:
        return "Customer Care Inquiry";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-md rounded-3xl border border-[#DCE7D8] shadow-[0_10px_35px_rgba(41,55,45,0.04)] overflow-hidden transition-all animate-fade-in">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-[#DCE7D8]/60 text-center">
        <span className="text-[11px] font-medium uppercase tracking-widest text-[#6B8068] mb-1 block">
          Aura Customer Care
        </span>
        <h2 className="font-serif font-medium text-2xl text-[#29372D]">
          Conversation recap
        </h2>
        <p className="text-xs text-[#29372D]/60 mt-1">
          Call ID: <span className="font-mono">{summary.call_id}</span>
        </p>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6">
        {/* Outcome and Intent highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 bg-[#FAF8F2] rounded-2xl border border-[#DCE7D8]/70">
            <span className="text-[10px] uppercase font-semibold text-[#29372D]/50 block mb-1">
              Topic
            </span>
            <span className="text-xs font-medium text-[#29372D]">
              {getIntentLabel(summary.customer_intent)}
            </span>
          </div>

          <div className="p-4 bg-[#FAF8F2] rounded-2xl border border-[#DCE7D8]/70">
            <span className="text-[10px] uppercase font-semibold text-[#29372D]/50 block mb-1">
              Order ID
            </span>
            <span className="text-xs font-mono font-medium text-[#29372D]">
              {summary.order_id || "None / General"}
            </span>
          </div>

          <div className="p-4 bg-[#FAF8F2] rounded-2xl border border-[#DCE7D8]/70">
            <span className="text-[10px] uppercase font-semibold text-[#29372D]/50 block mb-1">
              Status
            </span>
            <span className="text-xs font-medium text-[#6B8068]">
              {summary.resolution_status}
            </span>
          </div>
        </div>

        {/* Customer Issue & Outcome */}
        <div className="space-y-3">
          <div className="p-4 bg-[#FAF8F2] rounded-2xl border border-[#DCE7D8]/70">
            <span className="text-[10px] uppercase font-semibold text-[#29372D]/50 block mb-1">
              Customer issue
            </span>
            <p className="text-xs text-[#29372D] leading-relaxed">
              {summary.customer_issue}
            </p>
          </div>

          <div className="p-4 bg-[#FAF8F2] rounded-2xl border border-[#DCE7D8]/70">
            <span className="text-[10px] uppercase font-semibold text-[#29372D]/50 block mb-1">
              Actions taken & outcome
            </span>
            <p className="text-xs text-[#29372D] leading-relaxed font-medium">
              {summary.outcome}
            </p>
            {summary.actions_taken && summary.actions_taken.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-[#29372D]/70 list-disc list-inside">
                {summary.actions_taken.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Narrative Summary */}
        <div className="p-4 bg-[#FAF8F2] rounded-2xl border border-[#DCE7D8]/70">
          <span className="text-[10px] uppercase font-semibold text-[#29372D]/50 block mb-1.5">
            Executive Summary
          </span>
          <p className="text-xs text-[#29372D]/90 leading-relaxed">
            {summary.call_summary}
          </p>
        </div>

        {/* Follow up status badge */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF8F2] rounded-xl border border-[#DCE7D8]/60 text-xs text-[#29372D]">
          <span className="text-[11px] text-[#29372D]/70">Follow-up required:</span>
          <span className={`font-medium ${summary.follow_up_required ? "text-amber-800" : "text-[#6B8068]"}`}>
            {summary.follow_up_required ? (summary.follow_up_details || "Yes (Photos/Review pending)") : "No follow-up needed"}
          </span>
        </div>

        {/* Actions: Copy JSON and Start New Conversation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={onNewConversation}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#6B8068] hover:bg-[#576A54] text-white text-xs font-medium transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start a new conversation</span>
          </button>

          <button
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#FAF8F2] hover:bg-[#DCE7D8]/60 text-[#29372D] text-xs font-medium border border-[#DCE7D8] transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#6B8068]" />
                <span className="text-[#6B8068]">Copied to clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#29372D]/70" />
                <span>Copy JSON summary</span>
              </>
            )}
          </button>
        </div>

        {/* Chronological Transcript Section */}
        {transcript && transcript.length > 0 && (
          <div className="pt-4 border-t border-[#DCE7D8]/60">
            <button
              onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
              className="flex items-center justify-between w-full text-left text-xs text-[#29372D]/70 hover:text-[#29372D] py-1 transition-colors"
            >
              <div className="flex items-center gap-1.5 font-medium">
                <MessageSquare className="w-3.5 h-3.5 text-[#6B8068]" />
                <span>Full call transcript ({transcript.length} turns)</span>
              </div>
              {isTranscriptOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isTranscriptOpen && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto p-4 bg-[#FAF8F2] border border-[#DCE7D8] rounded-2xl">
                {transcript.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col text-xs ${
                      msg.sender === "customer" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-[#29372D]/50 uppercase">
                        {msg.sender === "customer" ? "Customer" : "Aria"}
                      </span>
                      <span className="text-[9px] text-[#29372D]/40">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                        msg.sender === "customer"
                          ? "bg-[#6B8068] text-white rounded-tr-xs"
                          : "bg-white border border-[#DCE7D8] text-[#29372D] rounded-tl-xs shadow-xs"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Disclosure for Raw Structured JSON */}
        <div className="pt-4 border-t border-[#DCE7D8]/60">
          <button
            onClick={() => setIsJsonOpen(!isJsonOpen)}
            className="flex items-center justify-between w-full text-left text-xs text-[#29372D]/70 hover:text-[#29372D] py-1 transition-colors"
          >
            <span className="font-medium">View technical details (structured JSON schema)</span>
            {isJsonOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isJsonOpen && (
            <div className="mt-3">
              <pre className="p-4 bg-[#FAF8F2] border border-[#DCE7D8] text-[#29372D] rounded-2xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                {jsonString}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
