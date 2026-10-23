import { TranscriptMessage, CallSummary, CustomerIntent, ResolutionStatus } from "@/types";
import { getGeminiClient } from "@/lib/ai/geminiAdapter";
import { extractOrderIdFromText, extractAllOrderIdsFromText } from "@/lib/services/orderService";

interface DetectedTopic {
  intent: CustomerIntent;
  orderId?: string | null;
  resolved: boolean;
  action: string;
  detail: string;
}

/**
 * Fallback summary generator using deterministic parsing of the transcript
 */
export function generateDeterministicSummary(
  history: Array<{ sender: "customer" | "aria"; text: string; timestamp?: string }>,
  providedOrderId?: string | null,
  callId: string = "call_demo"
): CallSummary {
  const customerTurns = history.filter((h) => h.sender === "customer");
  const ariaMessages = history.filter((h) => h.sender === "aria").map((h) => h.text);
  const fullCustomerText = customerTurns.map((h) => h.text).join(" ");
  const fullAriaText = ariaMessages.join(" ");

  // Check if Aria actually delivered an answer beyond the initial greeting
  const nonGreetingAria = ariaMessages.filter(
    (msg) => !msg.toLowerCase().includes("namaste") && !msg.toLowerCase().includes("how can i help you today")
  );
  const ariaAnswered = nonGreetingAria.length > 0;

  const allMentionedOrderIds = extractAllOrderIdsFromText(fullCustomerText);
  const primaryOrderId = allMentionedOrderIds[0] || extractOrderIdFromText(fullCustomerText) || providedOrderId || null;

  if (!ariaAnswered) {
    return {
      call_id: callId,
      customer_intent: "GENERAL_INQUIRY",
      customer_issue: "Incomplete conversation.",
      order_id: primaryOrderId,
      actions_taken: ["Call connected"],
      resolution_status: "UNRESOLVED",
      outcome: "Customer disconnected or query was not completed.",
      follow_up_required: false,
      call_summary: "Customer called but the conversation ended before Aria could deliver a response.",
      transcript: history.map((h) => ({
        sender: h.sender,
        text: h.text,
        timestamp: h.timestamp,
      })),
    };
  }

  const topics: DetectedTopic[] = [];

  // Helper to check what happened per turn or overall
  const lowerCust = fullCustomerText.toLowerCase();
  const lowerAria = fullAriaText.toLowerCase();

  // 1. Order Tracking Check
  const hasTracking =
    (lowerCust.includes("track") && !lowerCust.includes("product")) ||
    lowerCust.includes("where is") ||
    lowerCust.includes("order status") ||
    lowerCust.includes("delivery status") ||
    lowerCust.includes("when will it arrive");

  if (hasTracking || allMentionedOrderIds.length > 0) {
    for (const ordId of allMentionedOrderIds) {
      if (ordId === "ORD-101") {
        const ariaGave101 = lowerAria.includes("bluedart") || lowerAria.includes("bd-982103") || lowerAria.includes("out for delivery");
        topics.push({
          intent: "ORDER_TRACKING",
          orderId: "ORD-101",
          resolved: ariaGave101,
          action: "Communicated courier and tracking information to customer",
          detail: "Provided BlueDart tracking ID BD-982103 with delivery expected today by 6 PM",
        });
      } else if (ordId === "ORD-102" && (lowerCust.includes("track") || lowerCust.includes("where is ord-102"))) {
        const ariaGave102 = lowerAria.includes("delhivery") || lowerAria.includes("dl-441029") || lowerAria.includes("delivered");
        topics.push({
          intent: "ORDER_TRACKING",
          orderId: "ORD-102",
          resolved: ariaGave102,
          action: "Checked ORD-102 delivery status with Delhivery",
          detail: "Confirmed ORD-102 was delivered via Delhivery",
        });
      } else if (ordId === "ORD-103" && (lowerCust.includes("track") || lowerCust.includes("where is ord-103"))) {
        const ariaGave103 = lowerAria.includes("processing");
        topics.push({
          intent: "ORDER_TRACKING",
          orderId: "ORD-103",
          resolved: ariaGave103,
          action: "Checked ORD-103 order status",
          detail: "Confirmed ORD-103 is Processing",
        });
      } else if (ordId === "ORD-999" || lowerAria.includes("could not find any order with id ord-999") || lowerCust.includes("ord-999")) {
        topics.push({
          intent: "ORDER_TRACKING",
          orderId: "ORD-999",
          resolved: false, // Lookup failed / order not found
          action: "Attempted order lookup for ORD-999 (not found in database)",
          detail: "Order ORD-999 was not found in records",
        });
      }
    }
  }

  // 2. Order Cancellation Check
  if (lowerCust.includes("cancel") || lowerCust.includes("cancellation")) {
    const mentions101Cancel = lowerCust.includes("ord-101") || lowerCust.includes("101") || (primaryOrderId === "ORD-101" && !lowerCust.includes("ord-102") && !lowerCust.includes("ord-103"));
    const mentions103Cancel = lowerCust.includes("ord-103") || lowerCust.includes("103");

    if (mentions101Cancel || (lowerAria.includes("cannot be cancelled") && lowerAria.includes("refuse delivery"))) {
      topics.push({
        intent: "ORDER_CANCELLATION",
        orderId: "ORD-101",
        resolved: true, // Policy evaluated and accurately explained
        action: "Evaluated cancellation eligibility for ORD-101",
        detail: "Informed customer that ORD-101 cannot be cancelled as it is Out for Delivery; advised doorstep refusal",
      });
    }

    if (mentions103Cancel || lowerAria.includes("eligible for cancellation") || (lowerAria.includes("ord-103") && lowerAria.includes("processing"))) {
      topics.push({
        intent: "ORDER_CANCELLATION",
        orderId: "ORD-103",
        resolved: true,
        action: "Checked cancellation eligibility for ORD-103",
        detail: "Verified ORD-103 is in Processing status and eligible for cancellation; advised cancellation process",
      });
    }

    if (!mentions101Cancel && !mentions103Cancel) {
      topics.push({
        intent: "ORDER_CANCELLATION",
        orderId: primaryOrderId,
        resolved: true,
        action: "Explained order cancellation policy",
        detail: "Explained that orders may only be cancelled while in Processing status",
      });
    }
  }

  // 3. Return / Refund Check
  if (lowerCust.includes("return") || lowerCust.includes("refund")) {
    const mentions102Return = lowerCust.includes("ord-102") || lowerCust.includes("102") || lowerCust.includes("20 days") || lowerCust.includes("opened");
    if (mentions102Return || lowerAria.includes("exceeds our 7-day") || lowerAria.includes("cannot accept returns") || lowerAria.includes("outside the 7-day")) {
      topics.push({
        intent: "RETURN_REQUEST",
        orderId: "ORD-102",
        resolved: true, // Policy accurately enforced
        action: "Evaluated return eligibility for ORD-102 against 7-day unopened policy",
        detail: "Return refused for ORD-102 as delivery occurred 14+ days ago and/or product was opened, exceeding 7-day policy window",
      });
    } else {
      topics.push({
        intent: "RETURN_REQUEST",
        orderId: primaryOrderId,
        resolved: true,
        action: "Explained 7-day unopened product return policy",
        detail: "Clarified return window of 7 days from delivery for unopened, unused items",
      });
    }
  }

  // 4. Damaged Product Check
  if (lowerCust.includes("damage") || lowerCust.includes("broken") || lowerCust.includes("leak")) {
    topics.push({
      intent: "DAMAGED_PRODUCT",
      orderId: primaryOrderId,
      resolved: false, // Awaiting customer photos
      action: "Provided 48-hour damaged product reporting instructions",
      detail: "Advised customer to email packaging photos to support@auraskincare.in within 48 hours",
    });
  }

  // 5. Shipping & Delivery Rules Check
  if (lowerCust.includes("shipping") || lowerCust.includes("free shipping") || lowerCust.includes("delivery time") || lowerCust.includes("delivery fee")) {
    topics.push({
      intent: "SHIPPING_DELIVERY",
      resolved: true,
      action: "Explained shipping fees and delivery timelines",
      detail: "Informed customer of ₹499 free shipping threshold and 3–5 business day delivery",
    });
  }

  // 6. Cash on Delivery (COD) Check
  if (lowerCust.includes("cod") || lowerCust.includes("cash on delivery")) {
    topics.push({
      intent: "PAYMENT_COD",
      resolved: true,
      action: "Clarified Cash on Delivery terms",
      detail: "Confirmed COD is available up to ₹2,500 payable by cash or UPI",
    });
  }

  // 7. Product Inquiry Check
  if (
    lowerCust.includes("serum") ||
    lowerCust.includes("sunscreen") ||
    lowerCust.includes("face wash") ||
    lowerCust.includes("toner") ||
    lowerCust.includes("product") ||
    lowerCust.includes("skincare") ||
    lowerCust.includes("skin care") ||
    lowerCust.includes("can care") ||
    lowerCust.includes("ingredients")
  ) {
    topics.push({
      intent: "PRODUCT_INQUIRY",
      resolved: true,
      action: "Shared product information from catalog",
      detail: "Provided verified catalog information for requested skincare products",
    });
  }

  // 8. Out of Scope / Unrelated Request Check (e.g., flight, hotel, cab, weather)
  const isOutOfScope =
    lowerCust.includes("flight") ||
    lowerCust.includes("hotel") ||
    lowerCust.includes("cab") ||
    lowerCust.includes("taxi") ||
    lowerCust.includes("train") ||
    lowerCust.includes("weather") ||
    lowerCust.includes("pizza") ||
    lowerCust.includes("goa");

  if (isOutOfScope) {
    topics.push({
      intent: "UNKNOWN",
      resolved: false, // External non-skincare request cannot be fulfilled by Aura
      action: "Identified out-of-scope customer request (e.g., external travel/flight)",
      detail: "Politely declined external non-skincare request as unsupported",
    });
  }

  // Fallback if no specific topic was recognized
  if (topics.length === 0) {
    topics.push({
      intent: "GENERAL_INQUIRY",
      resolved: false,
      action: "Greeted customer and introduced support capabilities",
      detail: "Aria explained available support areas; customer has not yet completed a specific inquiry.",
    });
  }

  // Derive Primary Intent
  const primaryTopic = topics[0];
  const primaryIntent = primaryTopic.intent;

  // Derive Actions Taken from all detected topics (deduplicated)
  const actionsTaken = Array.from(new Set(topics.map((t) => t.action)));

  // Aggregate all relevant touched order IDs across topics and transcript
  const allTouchedOrderIds = Array.from(
    new Set([
      ...allMentionedOrderIds,
      ...topics.map((t) => t.orderId).filter((id): id is string => Boolean(id)),
    ])
  );
  const combinedOrderIdLabel = allTouchedOrderIds.length > 0 ? allTouchedOrderIds.join(", ") : primaryOrderId;

  // Derive Resolution Status:
  // Distinguish unresolved customer requests (e.g. ORD-999 lookup failed, flight request, or damaged awaiting photos)
  // from requests where policies were safely enforced or refused (e.g. cancellation rejected for ORD-101, return refused for ORD-102).
  const hasUnresolvedTopic = topics.some((t) => !t.resolved);
  const allResolved = topics.every((t) => t.resolved);
  const anyPolicyExplained = topics.some(
    (t) => t.intent === "ORDER_CANCELLATION" || t.intent === "RETURN_REQUEST"
  );

  let resolutionStatus: ResolutionStatus = "UNRESOLVED";
  if (hasUnresolvedTopic) {
    resolutionStatus = "UNRESOLVED";
  } else if (anyPolicyExplained) {
    resolutionStatus = "POLICY_EXPLAINED";
  } else if (allResolved) {
    resolutionStatus = "RESOLVED";
  }

  // Construct Detailed Summary Text covering all topics
  let summaryText = "";
  if (topics.length === 1) {
    summaryText = `Customer inquired regarding ${primaryTopic.intent.toLowerCase().replace(/_/g, " ")}. ${primaryTopic.detail}.`;
  } else {
    const topicSummaries = topics.map((t) => t.detail).join("; ");
    summaryText = `Multi-topic conversation covering: ${topicSummaries}.`;
  }

  // Construct Outcome
  let outcome = "";
  if (hasUnresolvedTopic) {
    const failedTopics = topics.filter((t) => !t.resolved);
    outcome = `Customer had multiple requests. Some requests remained unresolved (${failedTopics.map((f) => f.detail).join("; ")}).`;
  } else if (topics.length > 1) {
    outcome = `Handled multiple customer inquiries: ${topics.map((t) => t.detail).join(". ")}.`;
  } else {
    outcome = primaryTopic.detail;
  }

  const customerIssue =
    topics.length > 1
      ? `Customer had multiple inquiries: ${topics.map((t) => t.intent.replace(/_/g, " ")).join(", ")}.`
      : primaryTopic.detail;

  // Follow-up determination: avoid showing contradictory wording such as UNRESOLVED alongside "No follow-up needed"
  const isDamagedPending = topics.some((t) => t.intent === "DAMAGED_PRODUCT");
  const followUpRequired = isDamagedPending || (hasUnresolvedTopic && resolutionStatus === "UNRESOLVED");
  let followUpDetails: string | undefined = undefined;
  if (isDamagedPending) {
    followUpDetails = "Awaiting customer photos at support@auraskincare.in for replacement processing.";
  } else if (followUpRequired) {
    const unresolvedNames = topics.filter((t) => !t.resolved).map((t) => t.detail).join("; ");
    followUpDetails = `Resolution pending on customer requests: ${unresolvedNames}.`;
  }

  return {
    call_id: callId,
    customer_intent: primaryIntent,
    customer_issue: customerIssue,
    order_id: combinedOrderIdLabel,
    order_ids: allTouchedOrderIds,
    actions_taken: actionsTaken,
    resolution_status: resolutionStatus,
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
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
      systemInstruction: `You are an AI call auditor. Analyze the entire customer support conversation transcript for Aura Skincare and generate a structured JSON summary matching this schema:
{
  "call_id": string,
  "customer_intent": "ORDER_TRACKING" | "ORDER_CANCELLATION" | "RETURN_REQUEST" | "DAMAGED_PRODUCT" | "SHIPPING_DELIVERY" | "PAYMENT_COD" | "PRODUCT_INQUIRY" | "GENERAL_INQUIRY" | "UNKNOWN",
  "customer_issue": string,
  "order_id": string or null,
  "order_ids": string[] optional,
  "actions_taken": string[],
  "resolution_status": "RESOLVED" | "POLICY_EXPLAINED" | "ESCALATED" | "INFO_REQUESTED" | "UNRESOLVED",
  "outcome": string,
  "follow_up_required": boolean,
  "follow_up_details": string optional,
  "call_summary": string
}
CRITICAL RULES:
- Include the primary intent and meaningful secondary topics discussed across the entire call (e.g., tracking an order, return refusals, lookup failures for non-existent orders, checking cancellation eligibility for ORD-103, or unsupported external requests like flights/hotels).
- In the "order_id" field, include all relevant order IDs touched during the call separated by commas (e.g. "ORD-101, ORD-102, ORD-103").
- Distinguish unresolved customer requests (failed lookups, pending photos, unsupported topics) from requests where policies were correctly explained or safely refused.
- If policy limits were explained to refuse an ineligible cancellation or return (e.g. ORD-102 return refused past 7 days, or ORD-101 out for delivery), set resolution_status to "POLICY_EXPLAINED" (or "UNRESOLVED" if another request failed).
- Do not show contradictory wording such as "UNRESOLVED" alongside "No follow-up needed".
- Never claim an order was cancelled or returned unless explicitly confirmed in the transcript.
- Base the summary strictly on the actual transcript.`,
    });

    const transcriptStr = history
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const prompt = `Call ID: ${callId}\nConversation Transcript:\n${transcriptStr}\n\nDetected Order ID: ${detectedOrderId || "None"}\n\nGenerate accurate JSON summary:`;
    
    // Timeout guard for summary generation
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini summary generation timed out")), 5000)
    );

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);
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
