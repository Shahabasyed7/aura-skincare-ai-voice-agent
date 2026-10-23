"use client";

import React, { useEffect, useState } from "react";
import { MockOrder } from "@/types";
import { Package, X, HelpCircle, Truck, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";

interface EvaluatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTestScenario: (message: string) => void;
}

export const EvaluatorDrawer: React.FC<EvaluatorDrawerProps> = ({
  isOpen,
  onClose,
  onTestScenario,
}) => {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/orders")
        .then((res) => res.json())
        .then((data) => {
          if (data.orders) setOrders(data.orders);
          setLoading(false);
        })
        .catch((err) => {
          console.warn("Failed to load demo orders:", err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#FAF8F2] rounded-3xl border border-[#DCE7D8] shadow-[0_20px_50px_rgba(41,55,45,0.15)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DCE7D8] bg-white/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#6B8068]" />
            <h3 className="font-serif font-medium text-base text-[#29372D]">
              Evaluator Testing Tools
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-200/50 flex items-center justify-center text-[#29372D]/70 hover:text-[#29372D] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#29372D]">
          <p className="text-[#29372D]/70 leading-relaxed">
            Test the deterministic policy engine and order lookup logic across the canonical mock scenarios. Selecting any test will start a call and send the query directly to Aria.
          </p>

          {/* Section 1: Canonical Orders */}
          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#29372D]/50 block">
              Canonical Mock Orders
            </span>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.order_id}
                  className="p-4 rounded-2xl bg-white border border-[#DCE7D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#29372D]">
                        {order.order_id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#DCE7D8] text-[#29372D]">
                        {order.status}
                      </span>
                    </div>
                    <p className="font-medium text-[#29372D]">
                      {order.product_name} • ₹{order.amount}
                    </p>
                    <p className="text-[11px] text-[#29372D]/60">
                      Customer: {order.customer_name}
                      {order.courier && ` | Courier: ${order.courier}`}
                      {order.expected_delivery && ` (${order.expected_delivery})`}
                      {order.delivery_date_description && ` (${order.delivery_date_description})`}
                    </p>
                  </div>

                  {/* Test Action Buttons */}
                  <div className="flex flex-wrap sm:flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        onTestScenario(`Where is my order ${order.order_id}?`);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FAF8F2] hover:bg-[#DCE7D8] border border-[#DCE7D8] text-[#29372D] text-[11px] font-medium transition-colors text-left"
                    >
                      Track {order.order_id}
                    </button>

                    {order.order_id === "ORD-101" && (
                      <button
                        onClick={() => {
                          onTestScenario(`I want to cancel order ${order.order_id}`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF8F2] hover:bg-rose-50 border border-[#DCE7D8] text-[#29372D] text-[11px] font-medium transition-colors text-left"
                      >
                        Cancel {order.order_id} (Refusal test)
                      </button>
                    )}

                    {order.order_id === "ORD-102" && (
                      <button
                        onClick={() => {
                          onTestScenario(`Can I return order ${order.order_id}?`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF8F2] hover:bg-rose-50 border border-[#DCE7D8] text-[#29372D] text-[11px] font-medium transition-colors text-left"
                      >
                        Return {order.order_id} (&gt;7 days test)
                      </button>
                    )}

                    {order.order_id === "ORD-103" && (
                      <button
                        onClick={() => {
                          onTestScenario(`I need to cancel order ${order.order_id}`);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF8F2] hover:bg-emerald-50 border border-[#DCE7D8] text-[#29372D] text-[11px] font-medium transition-colors text-left"
                      >
                        Cancel {order.order_id} (Allowed test)
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Section 2: Policy Direct Tests */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#29372D]/50 block">
              Direct Policy Question Tests
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onTestScenario("What are your shipping rates and how long does delivery take?");
                  onClose();
                }}
                className="p-3 rounded-xl bg-white hover:bg-[#DCE7D8]/60 border border-[#DCE7D8] text-left transition-colors"
              >
                <div className="font-medium text-[#29372D]">Shipping Policy</div>
                <div className="text-[10px] text-[#29372D]/60 mt-0.5">₹499 rule & 3–5 days</div>
              </button>

              <button
                onClick={() => {
                  onTestScenario("My bottle arrived broken and leaked in the package. What should I do?");
                  onClose();
                }}
                className="p-3 rounded-xl bg-white hover:bg-[#DCE7D8]/60 border border-[#DCE7D8] text-left transition-colors"
              >
                <div className="font-medium text-[#29372D]">Damaged Item Policy</div>
                <div className="text-[10px] text-[#29372D]/60 mt-0.5">48-hour photo window</div>
              </button>

              <button
                onClick={() => {
                  onTestScenario("Can I pay using Cash on Delivery for my order?");
                  onClose();
                }}
                className="p-3 rounded-xl bg-white hover:bg-[#DCE7D8]/60 border border-[#DCE7D8] text-left transition-colors"
              >
                <div className="font-medium text-[#29372D]">COD Policy</div>
                <div className="text-[10px] text-[#29372D]/60 mt-0.5">₹2,500 limit & UPI/cash</div>
              </button>
            </div>
          </div>

          {/* Policy quick reference */}
          <div className="p-4 rounded-2xl bg-[#DCE7D8]/30 border border-[#DCE7D8] text-[11px] space-y-1 text-[#29372D]/80">
            <p className="font-semibold text-[#29372D]">Aura Deterministic Policy Guardrails:</p>
            <p>• Free shipping on orders &gt; ₹499; ₹50 fee on ≤ ₹499 (3–5 business days).</p>
            <p>• Returns: Strictly within 7 days of delivery for unopened products in original packaging.</p>
            <p>• Damaged items: Within 48 hours of delivery with photos to support@auraskincare.in.</p>
            <p>• Cancellations: Allowed ONLY while Processing. Shipped/Out for Delivery must refuse at doorstep.</p>
            <p>• COD: Allowed up to ₹2,500 payable via cash or UPI.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
