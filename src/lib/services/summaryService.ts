import { TranscriptMessage, CallSummary, CustomerIntent, ResolutionStatus } from "@/types";
import { getGeminiClient } from "@/lib/ai/geminiAdapter";
import { extractOrderIdFromText } from "@/lib/services/orderService";

/**
 * Fallback summary generator using deterministic parsing of the transcript
 */
export function generateDeterministicSummary(
  history: Array<{ sender: "customer" | "aria"; text: string; timestamp?: string }>,
  providedOrderId?: string | null,
  callId: string = "call_demo"
): CallSummary {
  const fullCustomerText = history
    .filter((h) => h.sender === "customer")
    .map((h) => h.text)
    .join(" ");

  const detectedId =
    providedOrderId ||
    extractOrderIdFromText(fullCustomerText) ||
    history.map((h) => extractOrderIdFromText(h.text)).find((id) => id !== null) ||
    null;

  const lower = fullCustomerText.toLowerCase();

  let intent: CustomerIntent = "GENERAL_INQUIRY";
  let status: ResolutionStatus = "RESOLVED";
  let customerIssue = "General skincare or order assistance.";
  let actionsTaken: string[] = ["Greeted customer", "Informed customer of Aura Skincare care policies"];
  let outcome = "Query addressed.";
  let followUpRequired = false;
  let followUpDetails: string | undefined = undefined;
  let summaryText = "Customer called Aura Skincare support.";

  if (lower.includes("track") || lower.includes("where") || lower.includes("delivery status")) {
    intent = "ORDER_TRACKING";
    customerIssue = `Inquired regarding live tracking and delivery status for ${detectedId || "order"}.`;
    actionsTaken = ["Extracted order ID", "Retrieved courier & tracking information from internal database"];
    if (detectedId === "ORD-101") {
      outcome = "Provided BlueDart tracking ID BD-982103 with delivery expected today by 6 PM.";
    } else if (detectedId === "ORD-102") {
      outcome = "Confirmed package was delivered 14 days ago via Delhivery.";
    } else if (detectedId === "ORD-103") {
      outcome = "Confirmed order is Processing and will be dispatched in 3–5 business days.";
    } else {
      outcome = "Provided verified order status.";
    }
    summaryText = detectedId
      ? `Customer asked about delivery status for ${detectedId}. Agent retrieved courier tracking and expected arrival details.`
      : "Customer requested order tracking details. Agent explained tracking requirements.";
  } else if (lower.includes("cancel")) {
    intent = "ORDER_CANCELLATION";
    status = "POLICY_EXPLAINED";
    customerIssue = `Requested cancellation for ${detectedId || "order"}.`;
    actionsTaken = ["Checked order fulfillment status against deterministic cancellation policy"];
    if (detectedId === "ORD-101") {
      outcome = "Cancellation denied as order is Out for Delivery. Advised customer to refuse delivery at doorstep.";
    } else if (detectedId === "ORD-103") {
      status = "RESOLVED";
      outcome = "Cancellation approved as order is in Processing status.";
    } else {
      outcome = "Explained that only Processing orders are eligible for cancellation.";
    }
    summaryText = detectedId
      ? `Customer requested cancellation for ${detectedId}. Agent evaluated eligibility under the Processing-only cancellation policy.`
      : "Customer asked about order cancellation policy. Agent explained that only Processing orders can be cancelled.";
  } else if (lower.includes("return") || lower.includes("refund")) {
    intent = "RETURN_REQUEST";
    status = "POLICY_EXPLAINED";
    customerIssue = `Requested return for ${detectedId || "order"}.`;
    actionsTaken = ["Checked delivery date against 7-day unopened product return window"];
    if (detectedId === "ORD-102") {
      outcome = "Return denied as delivery occurred 14 days ago, exceeding the strict 7-day window.";
    } else {
      outcome = "Explained our 7-day return policy for unopened, unused products in original packaging.";
    }
    summaryText = detectedId
      ? `Customer inquired about returning order ${detectedId}. Agent verified the 7-day unopened return policy window.`
      : "Customer inquired about returns. Agent explained our 7-day unopened product return policy.";
  } else if (lower.includes("damage") || lower.includes("broken") || lower.includes("leak")) {
    intent = "DAMAGED_PRODUCT";
    status = "INFO_REQUESTED";
    customerIssue = "Reported damaged or defective product received.";
    actionsTaken = ["Explained 48-hour damage reporting window", "Requested photographic evidence"];
    outcome = "Advised customer to email photos of product and packaging to support@auraskincare.in within 48 hours for replacement.";
    followUpRequired = true;
    followUpDetails = "Awaiting customer photos at support@auraskincare.in for replacement processing.";
    summaryText = "Customer reported a damaged product. Agent provided instructions for the 48-hour photo verification and replacement process.";
  } else if (lower.includes("shipping") || lower.includes("free shipping") || lower.includes("delivery time")) {
    intent = "SHIPPING_DELIVERY";
    customerIssue = "Inquired about shipping fees and delivery timelines.";
    actionsTaken = ["Explained ₹499 free shipping threshold", "Clarified 3–5 business days timeline"];
    outcome = "Customer informed: Free shipping above ₹499, ₹50 fee below ₹499, 3–5 business days delivery.";
    summaryText = "Customer asked about shipping rates and delivery timelines. Agent explained ₹499 free shipping threshold and 3–5 day delivery.";
  } else if (lower.includes("cod") || lower.includes("cash on delivery") || lower.includes("pay")) {
    intent = "PAYMENT_COD";
    customerIssue = "Inquired about Cash on Delivery (COD) terms.";
    actionsTaken = ["Explained ₹2,500 COD limit", "Clarified cash or UPI payment at doorstep"];
    outcome = "Confirmed COD available up to ₹2,500 payable by cash or UPI.";
    summaryText = "Customer asked about Cash on Delivery options. Agent confirmed COD availability up to ₹2,500 payable via cash or UPI.";
  } else if (lower.includes("serum") || lower.includes("sunscreen") || lower.includes("face wash") || lower.includes("product")) {
    intent = "PRODUCT_INQUIRY";
    customerIssue = "Inquired about Aura Skincare organic botanical products and ingredients.";
    actionsTaken = ["Shared product formulations and benefits"];
    outcome = "Product guidance provided for organic botanical skincare.";
    summaryText = "Customer inquired regarding Aura Skincare botanical product lineup and ingredients.";
  }

  return {
    call_id: callId,
    customer_intent: intent,
    customer_issue: customerIssue,
    order_id: detectedId,
    actions_taken: actionsTaken,
    resolution_status: status,
    outcome,
    follow_up_required: followUpRequired,
    follow_up_details: followUpDetails,
    call_summary: summaryText,
    transcript: history.map((h) => ({
      sender: h.sender,
      text: h.text,
      timestamp: h.timestamp,
    })),
  };
}

/**
 * Generate call summary at call end. Uses Gemini if available, otherwise deterministic rule-based generator.
 */
export async function generateCallSummary(
  history: Array<{ sender: "customer" | "aria"; text: string; timestamp?: string }>,
  detectedOrderId?: string | null,
  callId: string = "call_demo"
): Promise<CallSummary> {
  if (!history || history.length === 0) {
    return {
      call_id: callId,
      customer_intent: "GENERAL_INQUIRY",
      customer_issue: "Call connected without spoken dialogue.",
      order_id: null,
      actions_taken: ["Call connected"],
      resolution_status: "RESOLVED",
      outcome: "Call ended.",
      follow_up_required: false,
      call_summary: "Call connected and completed with no dialogue.",
      transcript: [],
    };
  }

  const client = getGeminiClient();
  if (!client) {
    return generateDeterministicSummary(history, detectedOrderId, callId);
  }

  try {
    const model = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
      systemInstruction: `You are an AI call auditor. Analyze the customer support conversation transcript for Aura Skincare and generate a structured JSON summary matching this schema:
{
  "call_id": string,
  "customer_intent": "ORDER_TRACKING" | "ORDER_CANCELLATION" | "RETURN_REQUEST" | "DAMAGED_PRODUCT" | "SHIPPING_DELIVERY" | "PAYMENT_COD" | "PRODUCT_INQUIRY" | "GENERAL_INQUIRY" | "UNKNOWN",
  "customer_issue": string,
  "order_id": string or null,
  "actions_taken": string[],
  "resolution_status": "RESOLVED" | "POLICY_EXPLAINED" | "ESCALATED" | "INFO_REQUESTED",
  "outcome": string,
  "follow_up_required": boolean,
  "follow_up_details": string optional,
  "call_summary": string
}
Do not fabricate facts. Base summary only on the actual conversation.`,
    });

    const transcriptStr = history
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const prompt = `Call ID: ${callId}\nConversation Transcript:\n${transcriptStr}\n\nDetected Order ID: ${detectedOrderId || "None"}\n\nGenerate JSON summary:`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      call_id: callId,
      customer_intent: parsed.customer_intent || "GENERAL_INQUIRY",
      customer_issue: parsed.customer_issue || "Customer inquiry handled.",
      order_id: parsed.order_id || detectedOrderId || null,
      actions_taken: Array.isArray(parsed.actions_taken) ? parsed.actions_taken : ["Verified query with Aura Care policies"],
      resolution_status: parsed.resolution_status || "RESOLVED",
      outcome: parsed.outcome || "Inquiry resolved.",
      follow_up_required: Boolean(parsed.follow_up_required),
      follow_up_details: parsed.follow_up_details,
      call_summary: parsed.call_summary || "Call completed.",
      transcript: history.map((h) => ({
        sender: h.sender,
        text: h.text,
        timestamp: h.timestamp,
      })),
    };
  } catch (err) {
    console.warn("LLM summary generation failed, using deterministic summary:", err);
    return generateDeterministicSummary(history, detectedOrderId, callId);
  }
}
