import { CustomerIntent, TranscriptMessage, MockOrder } from "@/types";
import { get_order_details, extractOrderIdFromText } from "@/lib/services/orderService";
import {
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamagedReportingEligibility,
  checkCodEligibility,
} from "@/lib/services/policyService";
import { generateAriaResponse } from "@/lib/ai/geminiAdapter";

export interface OrchestrationResult {
  reply: string;
  intent: CustomerIntent;
  detectedOrderId: string | null;
  toolResult?: {
    order?: MockOrder;
    policyExplanation?: string;
  };
  usedFallback: boolean;
}

/**
 * Detect customer intent deterministically from user utterances
 */
export function classifyIntent(text: string): CustomerIntent {
  const lower = text.toLowerCase();

  if (
    lower.includes("track") ||
    lower.includes("where is my order") ||
    lower.includes("delivery status") ||
    lower.includes("status of order") ||
    lower.includes("when will it arrive") ||
    lower.includes("expected delivery") ||
    /order status/i.test(lower)
  ) {
    return "ORDER_TRACKING";
  }

  if (
    lower.includes("cancel") ||
    lower.includes("stop order") ||
    lower.includes("don't want") ||
    lower.includes("do not want this order")
  ) {
    return "ORDER_CANCELLATION";
  }

  if (
    lower.includes("return") ||
    lower.includes("refund") ||
    lower.includes("exchange") ||
    lower.includes("send back")
  ) {
    return "RETURN_REQUEST";
  }

  if (
    lower.includes("damage") ||
    lower.includes("broken") ||
    lower.includes("defective") ||
    lower.includes("leaking") ||
    lower.includes("spilled") ||
    lower.includes("faulty")
  ) {
    return "DAMAGED_PRODUCT";
  }

  if (
    lower.includes("shipping") ||
    lower.includes("delivery fee") ||
    lower.includes("delivery charge") ||
    lower.includes("delivery time") ||
    lower.includes("how long does delivery take") ||
    lower.includes("free shipping")
  ) {
    return "SHIPPING_DELIVERY";
  }

  if (
    lower.includes("cod") ||
    lower.includes("cash on delivery") ||
    lower.includes("pay on delivery") ||
    lower.includes("upi at doorstep") ||
    lower.includes("cash payment")
  ) {
    return "PAYMENT_COD";
  }

  if (
    lower.includes("vitamin c") ||
    lower.includes("serum") ||
    lower.includes("sunscreen") ||
    lower.includes("face wash") ||
    lower.includes("toner") ||
    lower.includes("product") ||
    lower.includes("ingredients")
  ) {
    return "PRODUCT_INQUIRY";
  }

  if (
    lower.includes("hello") ||
    lower.includes("hi") ||
    lower.includes("hey") ||
    lower.includes("who are you") ||
    lower.includes("aura") ||
    lower.includes("help")
  ) {
    return "GENERAL_INQUIRY";
  }

  return "UNKNOWN";
}

/**
 * Deterministic fallback generator for when Gemini is unavailable, rate-limited, or quota-exceeded.
 * Ensures the app remains 100% functional without an active LLM key.
 */
export function getDeterministicReply(
  intent: CustomerIntent,
  orderId: string | null,
  toolData?: { order?: MockOrder; error?: string }
): string {
  if (orderId && toolData?.error) {
    return toolData.error;
  }

  switch (intent) {
    case "ORDER_TRACKING": {
      if (toolData?.order) {
        const o = toolData.order;
        if (o.status === "Out for Delivery") {
          return `Your order ${o.order_id} for ${o.product_name} is out for delivery with ${o.courier} (Tracking: ${o.tracking_id}) and is expected ${o.expected_delivery}.`;
        }
        if (o.status === "Delivered") {
          return `Your order ${o.order_id} for ${o.product_name} was delivered by ${o.courier} ${o.delivery_date_description}.`;
        }
        if (o.status === "Processing") {
          return `Your order ${o.order_id} for ${o.product_name} is currently processing and will be dispatched within 3–5 business days.`;
        }
        return `Order ${o.order_id} is currently ${o.status}.`;
      }
      return "Please share your order number, such as ORD-101, ORD-102, or ORD-103, so I can check the latest status for you.";
    }

    case "ORDER_CANCELLATION": {
      if (toolData?.order) {
        const check = checkCancellationEligibility(toolData.order);
        return check.reason;
      }
      return "Orders can be cancelled only while their status is Processing. Please provide your order ID so I can verify eligibility.";
    }

    case "RETURN_REQUEST": {
      if (toolData?.order) {
        const check = checkReturnEligibility(toolData.order);
        return check.reason;
      }
      return "Returns are accepted within 7 days of delivery for unopened, unused products in original packaging. Please share your order ID to check your window.";
    }

    case "DAMAGED_PRODUCT": {
      return "I'm so sorry to hear that. Damaged products must be reported within 48 hours of delivery with photos sent to support@auraskincare.in for immediate replacement.";
    }

    case "SHIPPING_DELIVERY": {
      return "Shipping is free on orders above ₹499, and ₹50 on orders ₹499 or below. Standard delivery takes 3 to 5 business days across India.";
    }

    case "PAYMENT_COD": {
      return "Cash on Delivery is available on orders up to ₹2,500. You can pay via cash or UPI directly to the delivery courier.";
    }

    case "PRODUCT_INQUIRY": {
      return "Aura Skincare crafts organic, botanical formulas including our 10% Vitamin C Serum, Hydrating Sunscreen SPF 50, and Green Tea Face Wash. How can I help you with our products?";
    }

    case "GENERAL_INQUIRY": {
      return "Hello! I am Aria from Aura Skincare. How can I assist you with your orders, shipping, or skincare products today?";
    }

    default:
      return "I am here to help you with order tracking, cancellations, returns, shipping, or product details. Could you please specify your question or provide your order ID?";
  }
}

/**
 * Main orchestrator: extracts intent, executes deterministic policy/order tools,
 * enriches context, and synthesizes 1-2 sentence spoken reply via Gemini (or fallback).
 */
export async function orchestrateAgentTurn(
  message: string,
  history: Array<{ sender: "customer" | "aria"; text: string }> = []
): Promise<OrchestrationResult> {
  const intent = classifyIntent(message);
  const detectedOrderId = extractOrderIdFromText(message);

  let verifiedContext = "";
  let toolResult: OrchestrationResult["toolResult"] = undefined;
  let orderLookupError: string | undefined = undefined;

  // Order lookup tool execution
  if (detectedOrderId) {
    const lookup = get_order_details(detectedOrderId);
    if (lookup.success && lookup.order) {
      toolResult = { order: lookup.order };
      verifiedContext += `[ORDER DATA FOUND]: ID: ${lookup.order.order_id}, Customer: ${lookup.order.customer_name}, Product: ${lookup.order.product_name}, Status: ${lookup.order.status}, Amount: ₹${lookup.order.amount}. Courier: ${lookup.order.courier || "N/A"}, Tracking: ${lookup.order.tracking_id || "N/A"}, Expected: ${lookup.order.expected_delivery || lookup.order.delivery_date_description || "N/A"}.\n`;

      if (intent === "ORDER_CANCELLATION") {
        const cancelCheck = checkCancellationEligibility(lookup.order);
        verifiedContext += `[DETERMINISTIC POLICY CHECK - CANCELLATION]: Allowed: ${cancelCheck.allowed}. Reason: ${cancelCheck.reason}\n`;
      } else if (intent === "RETURN_REQUEST") {
        const returnCheck = checkReturnEligibility(lookup.order);
        verifiedContext += `[DETERMINISTIC POLICY CHECK - RETURN]: Allowed: ${returnCheck.allowed}. Reason: ${returnCheck.reason}\n`;
      }
    } else {
      orderLookupError = lookup.error;
      verifiedContext += `[ORDER LOOKUP FAILED]: ${lookup.error}\n`;
    }
  }

  // Policy context rules
  if (intent === "SHIPPING_DELIVERY") {
    const feeInfo = calculateShippingFee(500);
    verifiedContext += `[DETERMINISTIC POLICY - SHIPPING]: Free shipping above ₹499. Orders ₹499 or below incur ₹50 fee. Standard delivery takes 3–5 business days.\n`;
  } else if (intent === "PAYMENT_COD") {
    verifiedContext += `[DETERMINISTIC POLICY - COD]: COD allowed up to ₹2,500. Cash or UPI accepted at delivery.\n`;
  } else if (intent === "DAMAGED_PRODUCT") {
    const damCheck = checkDamagedReportingEligibility(12);
    verifiedContext += `[DETERMINISTIC POLICY - DAMAGED]: ${damCheck.reason}\n`;
  }

  // Attempt generation via Gemini
  const llmRes = await generateAriaResponse(message, verifiedContext, history);

  if (!llmRes.isFallback && llmRes.reply) {
    return {
      reply: llmRes.reply,
      intent,
      detectedOrderId,
      toolResult,
      usedFallback: false,
    };
  }

  // Fallback generation (deterministic, 100% policy-compliant)
  const fallbackReply = getDeterministicReply(intent, detectedOrderId, {
    order: toolResult?.order,
    error: orderLookupError,
  });

  return {
    reply: fallbackReply,
    intent,
    detectedOrderId,
    toolResult,
    usedFallback: true,
  };
}
