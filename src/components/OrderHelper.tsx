"use client";

import React, { useEffect, useState } from "react";
import { MockOrder } from "@/types";
import { Package, Truck, CheckCircle2, Clock, ChevronRight } from "lucide-react";

interface OrderHelperProps {
  onSelectOrderText: (samplePrompt: string) => void;
}

export const OrderHelper: React.FC<OrderHelperProps> = ({ onSelectOrderText }) => {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const getStatusBadge = (status: MockOrder["status"]) => {
    switch (status) {
      case "Out for Delivery":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Truck className="w-3 h-3" />
            Out for Delivery
          </span>
        );
      case "Delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Delivered
          </span>
        );
      case "Processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-700" />
          <h3 className="font-semibold text-stone-800 text-sm">Evaluator Order Helper Panel</h3>
        </div>
        <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          Click any query to test
        </span>
      </div>

      <p className="text-xs text-stone-500 mb-4">
        Below are the 3 canonical test orders configured with Aura Skincare&apos;s deterministic policy rules:
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {orders.map((order) => (
            <div
              key={order.order_id}
              className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-emerald-50/40 hover:border-emerald-300 transition-all text-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-bold text-stone-900 text-sm">{order.order_id}</span>
                  {getStatusBadge(order.status)}
                </div>
                <p className="font-medium text-stone-800 truncate">{order.product_name}</p>
                <p className="text-stone-500 text-[11px]">
                  {order.customer_name} • ₹{order.amount}
                </p>

                <div className="mt-2 text-[11px] text-stone-600 bg-white p-2 rounded-lg border border-stone-200/70">
                  {order.order_id === "ORD-101" && (
                    <>
                      <p>Courier: <strong>{order.courier}</strong> ({order.tracking_id})</p>
                      <p className="text-amber-700 font-medium">{order.expected_delivery}</p>
                      <p className="text-stone-400 mt-0.5">Policy: Cannot cancel, refuse at door.</p>
                    </>
                  )}
                  {order.order_id === "ORD-102" && (
                    <>
                      <p>Delivered: <strong>{order.delivery_date_description}</strong></p>
                      <p>Courier: {order.courier} ({order.tracking_id})</p>
                      <p className="text-rose-700 font-medium">Policy: &gt;7 days, return ineligible.</p>
                    </>
                  )}
                  {order.order_id === "ORD-103" && (
                    <>
                      <p>Ordered: <strong>3 hours ago</strong></p>
                      <p className="text-emerald-700 font-medium">Policy: Cancellation eligible!</p>
                      <p className="text-stone-400 mt-0.5">Free shipping applied (₹850 &gt; ₹499).</p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-stone-200/60 flex flex-wrap gap-1.5">
                <button
                  onClick={() => onSelectOrderText(`Where is my order ${order.order_id}?`)}
                  className="px-2 py-1 bg-white hover:bg-emerald-100/60 border border-stone-200 text-stone-700 rounded text-[10px] font-medium transition-colors"
                >
                  Track {order.order_id}
                </button>
                {order.order_id === "ORD-103" && (
                  <button
                    onClick={() => onSelectOrderText(`I want to cancel order ${order.order_id}`)}
                    className="px-2 py-1 bg-white hover:bg-emerald-100/60 border border-stone-200 text-stone-700 rounded text-[10px] font-medium transition-colors"
                  >
                    Cancel {order.order_id}
                  </button>
                )}
                {order.order_id === "ORD-102" && (
                  <button
                    onClick={() => onSelectOrderText(`Can I return order ${order.order_id}?`)}
                    className="px-2 py-1 bg-white hover:bg-emerald-100/60 border border-stone-200 text-stone-700 rounded text-[10px] font-medium transition-colors"
                  >
                    Return {order.order_id}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
