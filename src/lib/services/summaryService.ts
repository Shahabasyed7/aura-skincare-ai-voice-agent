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

  const ariaMessages = history.filter((h) => h.sender === "aria").map((h) => h.text);
  const fullAriaText = ariaMessages.join(" ");

  // Check if Aria actually delivered an answer beyond the initial greeting
  const nonGreetingAria = ariaMessages.filter(
    (msg) => !msg.toLowerCase().includes("namaste") && !msg.toLowerCase().includes("how can i help you today")
  );
  const ariaAnswered = nonGreetingAria.length > 0;

  const lower = fullCustomerText.toLowerCase();
  const lowerAria = fullAriaText.toLowerCase();

  // An order ID is only truly detected if the customer provided it, or if explicitly passed
  const customerMentionedId = extractOrderIdFromText(fullCustomerText);
  const detectedId = customerMentionedId || providedOrderId || null;

  let intent: CustomerIntent = "GENERAL_INQUIRY";
  let status: ResolutionStatus = "UNRESOLVED";
  let customerIssue = "General skincare or order assistance.";
  let actionsTaken: string[] = ["Greeted customer"];
  let outcome = "Call ended before resolution.";
  let followUpRequired = false;
  let followUpDetails: string | undefined = undefined;
  let summaryText = "Customer called Aura Skincare support.";

  if (!ariaAnswered) {
    status = "UNRESOLVED";
    outcome = "Customer disconnected or query was not completed.";
    summaryText = "Customer called but the conversation ended before Aria could deliver a response.";
    return {
      call_id: callId,
      customer_intent: "GENERAL_INQUIRY",
      customer_issue: "Incomplete conversation.",
      order_id: detectedId,
      actions_taken: ["Call connected"],
      resolution_status: status,
      outcome,
      follow_up_required: false,
      call_summary: summaryText,
      transcript: history.map((h) => ({
        sender: h.sender,
        text: h.text,
        timestamp: h.timestamp,
      })),
    };
  }

  const isOrderTrackingQuery =
    Boolean(customerMentionedId && (lower.includes("track") || lower.includes("where") || lower.includes("status"))) ||
    (lower.includes("track") && !lower.includes("product")) ||
    (lower.includes("where is my order")) ||
    (lower.includes("order status"));

  if (isOrderTrackingQuery) {
    intent = "ORDER_TRACKING";
    customerIssue = `Inquired regarding live tracking and delivery status for ${detectedId || "order"}.`;
    
    // Check if Aria actually communicated tracking details in transcript
    const ariaGaveTracking =
      lowerAria.includes("tracking") ||
      lowerAria.includes("out for delivery") ||
      lowerAria.includes("bluedart") ||
      lowerAria.includes("delhivery") ||
      lowerAria.includes("processing") ||
      lowerAria.includes("delivered");

    if (ariaGaveTracking) {
      status = "RESOLVED";
      actionsTaken = ["Retrieved mock order record", "Communicated courier and tracking information to customer"];
      if (detectedId === "ORD-101") {
        outcome = "Provided BlueDart tracking ID BD-982103 with delivery expected today by 6 PM.";
      } else if (detectedId === "ORD-102") {
        outcome = "Confirmed package was delivered 14 days ago via Delhivery.";
      } else if (detectedId === "ORD-103") {
        outcome = "Confirmed order is Processing and will be dispatched in 3–5 business days.";
      } else {
        outcome = "Communicated order fulfillment details.";
      }
      summaryText = `Aria provided the current status, courier, tracking ID, and expected delivery time for ${detectedId || "the order"}.`;
    } else {
      status = "UNRESOLVED";
      outcome = "Order details were not fully delivered during the call.";
      summaryText = `Customer asked about tracking ${detectedId || "order"} but the call ended before full tracking details were provided.`;
    }
  } else if (lower.includes("cancel")) {
    intent = "ORDER_CANCELLATION";
    customerIssue = `Requested cancellation for ${detectedId || "order"}.`;
    actionsTaken = ["Checked order fulfillment status against cancellation policy"];
    if (detectedId === "ORD-101" || lowerAria.includes("cannot be cancelled") || lowerAria.includes("refuse delivery")) {
      status = "POLICY_EXPLAINED";
      outcome = "Cancellation denied as order is Out for Delivery. Advised customer to refuse delivery at doorstep.";
    } else if (detectedId === "ORD-103" || lowerAria.includes("eligible for cancellation")) {
      status = "RESOLVED";
      outcome = "Verified order is in Processing status and eligible for cancellation. Customer advised of cancellation eligibility.";
    } else {
      status = "POLICY_EXPLAINED";
      outcome = "Explained that only Processing orders are eligible for cancellation.";
    }
    summaryText = `Customer requested cancellation for ${detectedId || "order"}. Aria evaluated eligibility under the Processing-only cancellation policy.`;
  } else if (lower.includes("return") || lower.includes("refund")) {
    intent = "RETURN_REQUEST";
    customerIssue = `Requested return for ${detectedId || "order"}.`;
    actionsTaken = ["Checked delivery date against 7-day unopened product return window"];
    if (detectedId === "ORD-102" || lowerAria.includes("exceeds our 7-day") || lowerAria.includes("cannot accept returns")) {
      status = "POLICY_EXPLAINED";
      outcome = "Return denied as delivery occurred 14 days ago, exceeding the strict 7-day window.";
    } else {
      status = "POLICY_EXPLAINED";
      outcome = "Explained our 7-day return policy for unopened, unused products in original packaging.";
    }
    summaryText = `Customer inquired about returns. Aria verified the 7-day unopened return policy window.`;
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
    status = "RESOLVED";
    customerIssue = "Inquired about shipping fees and delivery timelines.";
    actionsTaken = ["Explained ₹499 free shipping threshold", "Clarified 3–5 business days timeline"];
    outcome = "Customer informed: Free shipping above ₹499, ₹50 fee below ₹499, 3–5 business days delivery.";
    summaryText = "Customer asked about shipping rates and delivery timelines. Agent explained ₹499 free shipping threshold and 3–5 day delivery.";
  } else if (lower.includes("cod") || lower.includes("cash on delivery") || lower.includes("pay")) {
    intent = "PAYMENT_COD";
    status = "RESOLVED";
    customerIssue = "Inquired about Cash on Delivery (COD) terms.";
    actionsTaken = ["Explained ₹2,500 COD limit", "Clarified cash or UPI payment at doorstep"];
    outcome = "Confirmed COD available up to ₹2,500 payable by cash or UPI.";
    summaryText = "Customer asked about Cash on Delivery options. Agent confirmed COD availability up to ₹2,500 payable via cash or UPI.";
  } else if (
    lower.includes("serum") ||
    lower.includes("sunscreen") ||
    lower.includes("face wash") ||
    lower.includes("toner") ||
    lower.includes("product") ||
    lower.includes("skincare") ||
    lower.includes("skin care") ||
    lower.includes("can care") ||
    lower.includes("ingredients")
  ) {
    intent = "PRODUCT_INQUIRY";
    status = "RESOLVED";
    customerIssue = "Inquired about Aura Skincare products.";
    actionsTaken = ["Shared product information from catalog"];
    outcome = "Product guidance provided from catalog.";
    summaryText = "Customer inquired regarding Aura Skincare product catalog.";
  } else {
    // Open-ended introductory or greetings
    intent = "GENERAL_INQUIRY";
    status = "UNRESOLVED";
    customerIssue = "Customer introduced themselves or asked general capabilities.";
    actionsTaken = ["Greeted customer", "Explained Aura Skincare support capabilities"];
    outcome = "Aria explained available support areas; customer has not yet completed a specific inquiry.";
    summaryText = "Customer initiated a conversation. Aria shared support options and welcomed further questions.";
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
      resolution_status: "UNRESOLVED",
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
  "resolution_status": "RESOLVED" | "POLICY_EXPLAINED" | "ESCALATED" | "INFO_REQUESTED" | "UNRESOLVED",
  "outcome": string,
  "follow_up_required": boolean,
  "follow_up_details": string optional,
  "call_summary": string
}
CRITICAL RULES:
- Mark resolution_status as "UNRESOLVED" if Aria did not actually deliver the requested order information or answer during the call, if the customer merely introduced themselves or asked general capabilities, or if the conversation ended abruptly.
- Mark as "RESOLVED" only when a specific actionable customer request (order tracking, product policy, or clear order query) was actually answered successfully in the transcript.
- Never claim in actions_taken, outcome, or call_summary that Aria communicated details (such as tracking numbers) unless those exact details appear in the transcript.
- Base the summary purely on the actual transcript.`,
    });

    const transcriptStr = history
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const prompt = `Call ID: ${callId}\nConversation Transcript:\n${transcriptStr}\n\nDetected Order ID: ${detectedOrderId || "None"}\n\nGenerate accurate JSON summary:`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      call_id: callId,
      customer_intent: parsed.customer_intent || "GENERAL_INQUIRY",
      customer_issue: parsed.customer_issue || "Customer inquiry handled.",
      order_id: parsed.order_id || detectedOrderId || null,
      actions_taken: Array.isArray(parsed.actions_taken) ? parsed.actions_taken : ["Verified query with Aura Care policies"],
      resolution_status: parsed.resolution_status || "UNRESOLVED",
      outcome: parsed.outcome || "Inquiry evaluated.",
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
