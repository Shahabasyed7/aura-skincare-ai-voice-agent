import { MockOrder } from "@/types";
import { BRAND_KNOWLEDGE } from "@/lib/data/mockData";

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
  policySummary: string;
}

/**
 * Deterministic shipping fee calculation:
 * - Free shipping on orders ABOVE ₹499 (i.e. amount > 499)
 * - Orders of ₹499 or less incur ₹50 shipping (i.e. amount <= 499)
 */
export function calculateShippingFee(orderAmount: number): {
  fee: number;
  isFree: boolean;
  explanation: string;
} {
  const threshold = BRAND_KNOWLEDGE.policies.free_shipping_threshold;
  const standardFee = BRAND_KNOWLEDGE.policies.standard_shipping_fee;

  if (orderAmount > threshold) {
    return {
      fee: 0,
      isFree: true,
      explanation: `Orders above ₹${threshold} qualify for free delivery. Standard delivery takes 3–5 business days.`,
    };
  }

  return {
    fee: standardFee,
    isFree: false,
    explanation: `Orders of ₹${threshold} or less have a standard shipping fee of ₹${standardFee}. Standard delivery takes 3–5 business days.`,
  };
}

/**
 * Deterministic order cancellation policy:
 * - Orders can be cancelled ONLY while their status is 'Processing'.
 * - Shipped or out-for-delivery orders cannot be cancelled; customers may refuse delivery at the doorstep.
 */
export function checkCancellationEligibility(order: MockOrder): PolicyCheckResult {
  if (order.status === "Cancelled") {
    return {
      allowed: false,
      reason: "This order is already cancelled.",
      policySummary: "Orders can only be cancelled once.",
    };
  }

  if (order.status === "Processing") {
    return {
      allowed: true,
      reason: `Order ${order.order_id} is currently Processing and is eligible for cancellation.`,
      policySummary: "Orders can be cancelled while status is Processing.",
    };
  }

  if (order.status === "Out for Delivery" || order.status === "Shipped") {
    return {
      allowed: false,
      reason: `Order ${order.order_id} is already ${order.status.toLowerCase()} and cannot be cancelled. You may refuse delivery at the doorstep when the courier arrives.`,
      policySummary: "Shipped or out-for-delivery orders cannot be cancelled; refusal at doorstep is permitted.",
    };
  }

  if (order.status === "Delivered") {
    return {
      allowed: false,
      reason: `Order ${order.order_id} has already been delivered and cannot be cancelled. You can request a return if eligible.`,
      policySummary: "Delivered orders cannot be cancelled; return policy applies.",
    };
  }

  return {
    allowed: false,
    reason: `Order ${order.order_id} cannot be cancelled at this stage.`,
    policySummary: "Orders can only be cancelled while Processing.",
  };
}

/**
 * Deterministic return policy:
 * - Returns are accepted within 7 days of delivery for unopened, unused products in original packaging.
 */
export function checkReturnEligibility(
  order: MockOrder,
  daysSinceDelivery?: number
): PolicyCheckResult {
  if (order.status !== "Delivered") {
    return {
      allowed: false,
      reason: `Order ${order.order_id} has not been delivered yet (status: ${order.status}), so return is not applicable.`,
      policySummary: "Returns only apply after product delivery.",
    };
  }

  const days = daysSinceDelivery !== undefined ? daysSinceDelivery : (order.delivered_days_ago ?? 0);
  const maxDays = BRAND_KNOWLEDGE.policies.return_window_days;

  if (days <= maxDays) {
    return {
      allowed: true,
      reason: `Order ${order.order_id} was delivered ${days} days ago and is within the 7-day return window. The product must be unopened, unused, and in its original packaging.`,
      policySummary: "Returns accepted within 7 days of delivery for unopened products in original packaging.",
    };
  }

  return {
    allowed: false,
    reason: `Order ${order.order_id} was delivered ${days} days ago, which exceeds our 7-day return window. We cannot accept returns beyond 7 days of delivery.`,
    policySummary: "Returns are strictly accepted only within 7 days of delivery.",
  };
}

/**
 * Deterministic damaged or defective product policy:
 * - Damaged or defective products must be reported within 48 hours, with photos, for replacement assistance.
 */
export function checkDamagedReportingEligibility(hoursSinceDelivery: number): PolicyCheckResult {
  const maxHours = BRAND_KNOWLEDGE.policies.damaged_window_hours;

  if (hoursSinceDelivery <= maxHours) {
    return {
      allowed: true,
      reason: `Your report is within the 48-hour window. Please share photos of the damaged product and outer packaging with support@auraskincare.in for immediate replacement assistance.`,
      policySummary: "Damaged/defective items reported within 48 hours with photos are eligible for replacement.",
    };
  }

  return {
    allowed: false,
    reason: `Damaged or defective products must be reported within 48 hours of delivery. As ${hoursSinceDelivery} hours have passed, we cannot offer an automated replacement, but our team can review special circumstances.`,
    policySummary: "Damaged items must be reported within 48 hours of delivery.",
  };
}

/**
 * Deterministic Cash on Delivery (COD) policy:
 * - COD is available up to ₹2,500; payment can be made by cash or UPI at delivery.
 */
export function checkCodEligibility(cartAmount: number): PolicyCheckResult {
  const maxLimit = BRAND_KNOWLEDGE.policies.cod_max_limit;

  if (cartAmount <= maxLimit) {
    return {
      allowed: true,
      reason: `Cash on Delivery is available for your order of ₹${cartAmount}. You can pay via cash or UPI directly to the courier partner upon delivery.`,
      policySummary: "COD available up to ₹2,500; payable via cash or UPI.",
    };
  }

  return {
    allowed: false,
    reason: `Cash on Delivery is only available for orders up to ₹${maxLimit}. For orders above ₹${maxLimit}, please use prepaid options like UPI, Cards, or NetBanking.`,
    policySummary: "COD is restricted to orders up to ₹2,500.",
  };
}
