"use client";

import React, { useState } from "react";
import { CallSummary } from "@/types";
import { FileText, Copy, Check, Info } from "lucide-react";

interface CallSummaryCardProps {
  summary: CallSummary | null;
}

export const CallSummaryCard: React.FC<CallSummaryCardProps> = ({ summary }) => {
  const [copied, setCopied] = useState(false);

  if (!summary) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm text-stone-500 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-stone-400" />
          <span>Call summary will appear here automatically when the call is ended.</span>
        </div>
        <span className="text-stone-400 font-mono text-[11px]">JSON Ready</span>
      </div>
    );
  }

  const jsonString = JSON.stringify(summary, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-700" />
          <h3 className="font-semibold text-stone-800 text-sm">Post-Call Structured Summary</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied JSON" : "Copy JSON"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
            Detected Intent
          </span>
          <span className="font-semibold text-emerald-900 font-mono">{summary.customer_intent}</span>
        </div>

        <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
            Associated Order
          </span>
          <span className="font-semibold text-stone-900 font-mono">
            {summary.order_id || "None / General"}
          </span>
        </div>

        <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
            Resolution Status
          </span>
          <span className="font-semibold text-teal-800 font-mono">{summary.resolution_status}</span>
        </div>
      </div>

      <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-100 text-xs text-stone-800">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
          Executive Summary
        </span>
        <p className="leading-relaxed">{summary.call_summary}</p>
      </div>

      <div>
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
          Standard Output JSON Schema
        </span>
        <pre className="p-3 bg-stone-900 text-emerald-300 rounded-xl font-mono text-xs overflow-x-auto">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
