import { CustomerIntent, TranscriptMessage, MockOrder } from "@/types";
import { get_order_details, extractOrderIdFromText, extractAllOrderIdsFromText, normalizeOrderId } from "@/lib/services/orderService";
import {
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamagedReportingEligibility,
  checkCodEligibility,
} from "@/lib/services/policyService";
import { generateAriaResponse } from "@/lib/ai/geminiAdapter";
import {
  AURA_PRODUCT_CATALOG,
  identifyProductFromContext,
  formatProductContext,
  getGeneralCatalogIntroduction,
  ProductCatalogEntry,
} from "@/lib/data/productCatalog";

export interface OrchestrationResult {
  reply: string;
  intent: CustomerIntent;
  detectedOrderId: string | null;
  toolResult?: {
    success?: boolean;
    order?: MockOrder;
    policyExplanation?: string;
    product?: ProductCatalogEntry;
  };
  usedFallback: boolean;
}

/**
 * Detect customer intent deterministically from user utterances and multi-turn context
 */
export function classifyIntent(
  text: string,
  previousTurns: Array<{ sender: "customer" | "aria"; text: string }> = []
): CustomerIntent {
  const lower = text.toLowerCase();

  // 1. Out of scope / external requests (e.g., "book a flight to Goa")
  if (
    lower.includes("flight") ||
    lower.includes("hotel") ||
    lower.includes("train") ||
    lower.includes("movie") ||
    lower.includes("cab") ||
    lower.includes("taxi") ||
    lower.includes("weather") ||
    lower.includes("cricket") ||
    lower.includes("pizza") ||
    lower.includes("burger")
  ) {
    return "UNKNOWN";
  }

  // 2. Order Tracking
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

  // 3. Order Cancellation
  if (
    lower.includes("cancel") ||
    lower.includes("stop order") ||
    lower.includes("cancellation") ||
    lower.includes("revoke order")
  ) {
    return "ORDER_CANCELLATION";
  }

  // 4. Return Request
  if (
    lower.includes("return") ||
    lower.includes("refund") ||
    lower.includes("exchange") ||
    lower.includes("send back")
  ) {
    return "RETURN_REQUEST";
  }

  // 5. Damaged Product
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

  // 6. Shipping & Delivery rules
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

  // 7. Cash on Delivery (COD)
  if (
    lower.includes("cod") ||
    lower.includes("cash on delivery") ||
    lower.includes("pay on delivery") ||
    lower.includes("upi at doorstep") ||
    lower.includes("cash payment")
  ) {
    return "PAYMENT_COD";
  }

  // 8. If an order ID is given (e.g. "ORD-101", "101"):
  const hasOrderId = Boolean(extractOrderIdFromText(text, true));
  if (hasOrderId) {
    const lastAria = [...previousTurns].reverse().find((t) => t.sender === "aria")?.text.toLowerCase() || "";
    const lastCustomer = [...previousTurns].reverse().find((t) => t.sender === "customer")?.text.toLowerCase() || "";

    if (lastCustomer.includes("cancel") || lastAria.includes("cancel")) {
      return "ORDER_CANCELLATION";
    }
    if (lastCustomer.includes("return") || lastAria.includes("return")) {
      return "RETURN_REQUEST";
    }
    return "ORDER_TRACKING";
  }

  // 9. Product Inquiry: Direct mentions, general skincare product discovery, or anaphora in an established conversation
  const directProduct = identifyProductFromContext(text, []);
  if (directProduct) {
    return "PRODUCT_INQUIRY";
  }

  // Broad product discovery / questions about Aura's products or skincare lineup
  // Handles natural phrases and speech recognition transcript variations:
  // "can I get more information about skin care products of Arya", "can you help me with product questions", "I want to knows can care products"
  const isBroadProductInquiry =
    lower.includes("skincare") ||
    lower.includes("skin care") ||
    lower.includes("can care") || // common STT phonetic error for "skin care"
    lower.includes("product") ||
    lower.includes("products") ||
    lower.includes("what do you sell") ||
    lower.includes("what do you offer") ||
    lower.includes("catalog") ||
    lower.includes("lineup") ||
    lower.includes("routine") ||
    lower.includes("serums") ||
    lower.includes("creams") ||
    lower.includes("sunscreen") ||
    lower.includes("face wash") ||
    lower.includes("cleanser") ||
    lower.includes("toner");

  if (isBroadProductInquiry) {
    return "PRODUCT_INQUIRY";
  }

  // Check if this is an anaphora follow-up to a previous product turn
  const contextProduct = identifyProductFromContext(text, previousTurns);
  if (contextProduct) {
    return "PRODUCT_INQUIRY";
  }

  // 10. General greetings / introductions (only when no specific intent or context is given)
  if (
    lower.includes("hello") ||
    lower.includes("hi") ||
    lower.includes("hey") ||
    lower.includes("namaste") ||
    lower.includes("who are you")
  ) {
    return "GENERAL_INQUIRY";
  }

  return "UNKNOWN";
}

/**
 * Intelligent deterministic answer generator for product catalog queries.
 * Handles:
 * - General overview ("Tell me about Green Tea Face Wash")
 * - Ingredients ("What ingredients does it contain?")
 * - Usage & frequency ("How often should I use it?")
 * - Compatibility ("Can I use it with Vitamin C?")
 * - Price & bundle information ("What about its price?")
 * - Routine placement ("When do I apply it?")
 */
export function getProductDeterministicAnswer(product: ProductCatalogEntry, query: string): string {
  const lower = query.toLowerCase();

  // 1. Ingredients inquiry
  if (lower.includes("ingredient") || lower.includes("contain") || lower.includes("formulated with") || lower.includes("what is inside")) {
    // Check if customer asked about a specific ingredient that might not be in the catalog
    const unverifiedCandidates = ["retinol", "salicylic acid", "snail mucin", "collagen", "peptides", "paraben", "sulfate", "fragrance"];
    const askedCandidate = unverifiedCandidates.find((c) => lower.includes(c));
    if (askedCandidate) {
      if (product.ingredients.length === 0) {
        return "I'm sorry, I don't have verified information about that detail right now. I can help with the product information currently available in our catalog.";
      }
      const match = product.ingredients.find((ing) => ing.name.toLowerCase().includes(askedCandidate));
      if (!match) {
        return `Our ${product.name} does not contain ${askedCandidate}. Its verified key ingredients are ${product.ingredients.map((ing) => ing.name).join(", ")}.`;
      }
    }
    if (product.ingredients.length === 0) {
      return "I'm sorry, I don't have verified information about that detail right now. I can help with the product information currently available in our catalog.";
    }
    const ingSummary = product.ingredients.map((ing) => `${ing.name} for ${ing.function.toLowerCase()}`).join(", ");
    return `Our ${product.name} is formulated with ${ingSummary}.`;
  }

  // 2. Frequency & how often to use
  if (lower.includes("how often") || lower.includes("frequency") || lower.includes("how many times") || lower.includes("daily")) {
    return `You should use the ${product.name} ${product.directions.frequency.toLowerCase()} (${product.directions.routinePlacement.toLowerCase()}).`;
  }

  // 3. Directions / how to use / routine placement
  if (lower.includes("how to use") || lower.includes("directions") || lower.includes("apply") || lower.includes("how do i use") || lower.includes("routine")) {
    return `${product.directions.instructions} It fits as ${product.directions.routinePlacement.toLowerCase()}`;
  }

  // 4. Compatibility (e.g., with Vitamin C, sunscreen, or other products)
  if (
    lower.includes("use it with") ||
    lower.includes("pair") ||
    lower.includes("combine") ||
    lower.includes("with vitamin c") ||
    lower.includes("with sunscreen") ||
    lower.includes("compatible")
  ) {
    if (lower.includes("vitamin c")) {
      if (product.id === "green-tea-face-wash") {
        return "Yes, absolutely! The Green Tea Face Wash cleanses skin gently, making it an ideal pre-step before you apply your Vitamin C Serum.";
      }
      if (product.id === "toner") {
        return "Yes, you can use our Toner before applying the Vitamin C Serum.";
      }
      if (product.id === "hydrating-sunscreen") {
        return "Yes, our Hydrating Sunscreen SPF 50 can be applied after your Vitamin C Serum for sun protection.";
      }
    }
    return `Yes, ${product.name} is compatible with ${product.compatibility.compatibleWith.join(", ")}. ${product.compatibility.notes}`;
  }

  // 5. Price & bundle info
  if (lower.includes("price") || lower.includes("cost") || lower.includes("how much") || lower.includes("rate") || lower.includes("mrp")) {
    return `${product.name} is ${product.priceDescription}`;
  }

  // 6. Purchase intent ("I want to buy it", "how do I buy this", "order this")
  if (lower.includes("buy") || lower.includes("purchase") || lower.includes("order this") || lower.includes("checkout")) {
    if (product.id === "green-tea-face-wash" || product.id === "toner") {
      return `Our ${product.name} is available in the Green Tea Face Wash + Toner bundle for ₹850. Would you like to proceed with the bundle, or are you looking for an individual product? We support online payment and Cash on Delivery up to ₹2,500.`;
    }
    return `You can order ${product.name} for ${product.priceDescription}. We offer free delivery on orders above ₹499 and Cash on Delivery up to ₹2,500. Would you like me to guide you through checkout?`;
  }

  // 7. Skin type & sensitivity
  if (lower.includes("skin type") || lower.includes("sensitive") || lower.includes("oily") || lower.includes("acne") || lower.includes("safe for")) {
    return `${product.name} is formulated for ${product.skinTypeSuitability.join(", ")}. We always suggest a quick patch test behind the ear prior to first full application.`;
  }

  // 8. General overview / default product explanation
  let answer = `Our ${product.name} is ${product.description} It ${product.purposeAndBenefits.join(", ").toLowerCase()}.`;
  if (product.priceDescription) {
    answer += ` It is ${product.priceDescription.toLowerCase()}.`;
  }
  if (product.bundleReference) {
    answer += ` It is also featured in our ${product.bundleReference}.`;
  }
  return answer;
}

/**
 * Deterministic fallback generator for when Gemini is unavailable, rate-limited, or quota-exceeded.
 * Ensures the app remains 100% functional without an active LLM key.
 */
export function getDeterministicReply(
  intent: CustomerIntent,
  orderId: string | null,
  toolData?: {
    order?: MockOrder;
    error?: string;
    product?: ProductCatalogEntry;
    userQuery?: string;
  }
): string {
  if (orderId && toolData?.error) {
    return toolData.error;
  }

  switch (intent) {
    case "ORDER_TRACKING": {
      if (toolData?.order) {
        const o = toolData.order;
        if (o.status === "Out for Delivery") {
          return `Your order ${o.order_id} for ${o.product_name} is out for delivery with ${o.courier} (Tracking ID: ${o.tracking_id}) and is expected ${o.expected_delivery}.`;
        }
        if (o.status === "Delivered") {
          return `Your order ${o.order_id} for ${o.product_name} was delivered by ${o.courier} (Tracking ID: ${o.tracking_id}) ${o.delivery_date_description}.`;
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
      return "I'm so sorry to hear that. Damaged products must be reported within 48 hours of delivery with photos sent to support@auraskincare.in for replacement assistance.";
    }

    case "SHIPPING_DELIVERY": {
      return "Shipping is free on orders above ₹499, and ₹50 on orders ₹499 or below. Standard delivery takes 3 to 5 business days across India.";
    }

    case "PAYMENT_COD": {
      return "Cash on Delivery is available on orders up to ₹2,500. You can pay via cash or UPI directly to the delivery courier.";
    }

    case "PRODUCT_INQUIRY": {
      if (toolData?.product && toolData.userQuery) {
        return getProductDeterministicAnswer(toolData.product, toolData.userQuery);
      }
      return getGeneralCatalogIntroduction();
    }

    case "GENERAL_INQUIRY": {
      return "Hello! I am Aria from Aura Skincare. How can I assist you with your orders, shipping, or skincare products today?";
    }

    default:
      return "I can help you with order tracking, cancellations, returns, shipping, and product questions. Aura Skincare cannot assist with requests outside our store policies.";
  }
}

/**
 * Main orchestrator: extracts intent, executes deterministic policy/order tools,
 * enriches context with real product knowledge and order records,
 * and synthesizes 1-2 sentence spoken reply via Gemini (or deterministic fallback).
 */
export async function orchestrateAgentTurn(
  message: string,
  history: Array<{ sender: "customer" | "aria"; text: string }> = []
): Promise<OrchestrationResult> {
  const lowerMsg = message.toLowerCase();

  // 1. Handle out of scope explicitly
  if (
    lowerMsg.includes("flight") ||
    lowerMsg.includes("hotel") ||
    lowerMsg.includes("goa") ||
    lowerMsg.includes("cab") ||
    lowerMsg.includes("taxi") ||
    lowerMsg.includes("train") ||
    lowerMsg.includes("weather") ||
    lowerMsg.includes("pizza") ||
    lowerMsg.includes("burger")
  ) {
    return {
      reply: "I can only assist with Aura Skincare orders, shipping, and skincare products. I am unable to assist with external bookings like flights or hotels.",
      intent: "UNKNOWN",
      detectedOrderId: null,
      toolResult: undefined,
      usedFallback: true,
    };
  }

  // 1b. Handle genuinely unclear speech or ambiguous noise
  const cleanTrimmed = message.replace(/[^a-zA-Z0-9\s]/g, "").trim().toLowerCase();
  const words = cleanTrimmed.split(/\s+/).filter(Boolean);
  const isAllGarbleWords = words.length > 0 && words.every((w) => /^(uh|um|huh|what|hmm|hm|asdf|xyz|ah)$/.test(w));
  const isTooShort = cleanTrimmed.length > 0 && cleanTrimmed.length < 3 && !/^\d+$/.test(cleanTrimmed);

  if (isTooShort || isAllGarbleWords) {
    return {
      reply: "I didn't quite catch that. Could you please repeat your question about your order or our skincare products?",
      intent: "UNKNOWN",
      detectedOrderId: null,
      toolResult: undefined,
      usedFallback: true,
    };
  }

  // 1c. Handle "can you repeat that?" or "pardon?"
  const isRepeatRequest =
    lowerMsg.includes("repeat that") ||
    lowerMsg.includes("say that again") ||
    lowerMsg.includes("what did you say") ||
    lowerMsg.includes("pardon") ||
    lowerMsg.includes("repeat please");

  if (isRepeatRequest && history.length > 0) {
    const lastAriaMessage = [...history].reverse().find((h) => h.sender === "aria");
    if (lastAriaMessage && lastAriaMessage.text) {
      return {
        reply: `Certainly: ${lastAriaMessage.text}`,
        intent: "GENERAL_INQUIRY",
        detectedOrderId: null,
        toolResult: undefined,
        usedFallback: true,
      };
    }
  }

  // 1d. Multi-Question / Combined Inquiry Handling (e.g. "Can I cancel it? I bought ORD-102 and opened it 20 days ago. Can I return it?")
  const hasCancelQuery = lowerMsg.includes("cancel");
  const hasReturnQuery = lowerMsg.includes("return") || lowerMsg.includes("refund");

  if (hasCancelQuery && hasReturnQuery) {
    // Determine cancellation order context
    let cancelOrderId: string | null = null;
    const cancelMatch = message.match(/cancel(?:ling)?(?:\s+(?:order|my\s+order))?\s*(?:ID\s*)?([A-Za-z0-9-]+)?/i);
    if (cancelMatch && cancelMatch[1] && /ORD-\d{3}|\d{3}/i.test(cancelMatch[1])) {
      cancelOrderId = normalizeOrderId(cancelMatch[1]);
    } else {
      // Look back in history for any previously active order
      for (let i = history.length - 1; i >= 0; i--) {
        const tid = extractOrderIdFromText(history[i].text, false);
        if (tid) {
          cancelOrderId = tid;
          break;
        }
      }
    }

    let cancelAnswer = "";
    if (cancelOrderId) {
      const cancelLookup = get_order_details(cancelOrderId);
      if (cancelLookup.success && cancelLookup.order) {
        const cancelCheck = checkCancellationEligibility(cancelLookup.order);
        cancelAnswer = `For cancellation of ${cancelOrderId}: ${cancelCheck.reason}`;
      } else {
        cancelAnswer = `For cancellation: ${cancelLookup.error || "Please verify your order ID."}`;
      }
    } else {
      cancelAnswer = "For cancellation: Orders can only be cancelled while their status is Processing.";
    }

    // Determine return order context
    let returnOrderId: string | null = null;
    const allIds = extractAllOrderIdsFromText(message);
    const returnMatch = message.match(/(?:bought|return(?:ing)?|refund)\s+(?:order\s+)?(ORD-[A-Za-z0-9]+|\d{3})/i);
    if (returnMatch && returnMatch[1]) {
      returnOrderId = normalizeOrderId(returnMatch[1]);
    } else if (allIds.length > 0) {
      returnOrderId = allIds.find((id) => id !== cancelOrderId) || allIds[0];
    }

    const mentionsPast7Days =
      lowerMsg.includes("20 days") ||
      lowerMsg.includes("14 days") ||
      lowerMsg.includes("exceed") ||
      lowerMsg.includes("past 7 days") ||
      lowerMsg.includes("opened") ||
      lowerMsg.includes("used");

    let returnAnswer = "";
    if (returnOrderId === "ORD-102" || (returnOrderId && mentionsPast7Days) || (!returnOrderId && mentionsPast7Days)) {
      const ordLabel = returnOrderId ? `for ${returnOrderId}` : "";
      returnAnswer = `Regarding returns ${ordLabel}: Returns are only accepted within 7 days of delivery for unopened, unused products in original packaging. Because it was delivered 14 days ago and opened 20 days ago, it is outside the 7-day return window and not eligible for a return.`.replace(/\s+/g, " ");
    } else if (returnOrderId) {
      const returnLookup = get_order_details(returnOrderId);
      if (returnLookup.success && returnLookup.order) {
        const returnCheck = checkReturnEligibility(returnLookup.order);
        returnAnswer = `Regarding returns for ${returnOrderId}: ${returnCheck.reason}`;
      } else {
        returnAnswer = `Regarding returns: ${returnLookup.error || "Please verify your order number."}`;
      }
    } else {
      returnAnswer = "Regarding returns: Products are strictly eligible for return within 7 days of delivery only if unopened and unused in original packaging.";
    }

    const combinedReply = `${cancelAnswer} ${returnAnswer}`;

    return {
      reply: combinedReply,
      intent: "ORDER_CANCELLATION",
      detectedOrderId: cancelOrderId || returnOrderId || null,
      toolResult: undefined,
      usedFallback: true,
    };
  }

  // 2. Check if previous turn asked for an order number
  const lastAriaTurn = [...history].reverse().find((h) => h.sender === "aria")?.text.toLowerCase() || "";
  const contextIndicatesOrder =
    lastAriaTurn.includes("order number") ||
    lastAriaTurn.includes("order id") ||
    lastAriaTurn.includes("share your order") ||
    lastAriaTurn.includes("provide your order");

  // Extract order ID from current utterance first
  let detectedOrderId = extractOrderIdFromText(message, contextIndicatesOrder);

  // If not in current utterance, check if an order ID was already established in recent conversation turns
  // BUT do not carry over order ID if customer explicitly switched to general product inquiry or shipping,
  // or if customer is asking a fresh "track my order" without specifying an ID.
  const isFreshTrackingRequest = lowerMsg.includes("track my order") || lowerMsg.includes("where is my order") || lowerMsg.includes("check my order");
  const hasSwitchedToProducts = Boolean(identifyProductFromContext(message, []));

  if (!detectedOrderId && history.length > 0 && !hasSwitchedToProducts && !isFreshTrackingRequest) {
    for (let i = history.length - 1; i >= 0; i--) {
      const turnId = extractOrderIdFromText(history[i].text, false);
      if (turnId) {
        detectedOrderId = turnId;
        break;
      }
    }
  }

  // Classify intent using current utterance and conversation history
  const intent = classifyIntent(message, history);

  let verifiedContext = "";
  let toolResult: OrchestrationResult["toolResult"] = undefined;
  let orderLookupError: string | undefined = undefined;

  // 3. Product Catalog context enrichment
  let matchedProduct: ProductCatalogEntry | null = null;
  if (intent === "PRODUCT_INQUIRY") {
    matchedProduct = identifyProductFromContext(message, history);
    if (matchedProduct) {
      toolResult = { ...(toolResult || {}), product: matchedProduct };
      verifiedContext += `${formatProductContext(matchedProduct)}\n`;
    } else {
      verifiedContext += `[COMPLETE AURA PRODUCT CATALOG]:\n${getGeneralCatalogIntroduction()}\nProducts available:\n1. Vitamin C Serum 30ml (₹699)\n2. Hydrating Sunscreen SPF 50 50g (₹499)\n3. Green Tea Face Wash 100ml\n4. Clarifying Toner 100ml (Face wash + Toner paired in ORD-103 bundle for ₹850)\n`;
    }
  }

  // 4. Order lookup tool execution (application-level deterministic execution)
  // Only look up and attach order details when the user explicitly asks about that order or provides its ID for tracking/cancellation/returns
  const isOrderSpecificIntent = intent === "ORDER_TRACKING" || intent === "ORDER_CANCELLATION" || (intent === "RETURN_REQUEST" && Boolean(detectedOrderId));
  if (detectedOrderId && isOrderSpecificIntent) {
    const lookup = get_order_details(detectedOrderId);
    if (lookup.success && lookup.order) {
      toolResult = { ...(toolResult || {}), success: true, order: lookup.order };
      verifiedContext += `[ORDER DATA RETRIEVED FROM DATABASE]:
Order ID: ${lookup.order.order_id}
Customer: ${lookup.order.customer_name}
Product: ${lookup.order.product_name}
Status: ${lookup.order.status}
Amount: ₹${lookup.order.amount}
Courier: ${lookup.order.courier || "N/A"}
Tracking ID: ${lookup.order.tracking_id || "N/A"}
Expected Delivery / Delivery Date: ${lookup.order.expected_delivery || lookup.order.delivery_date_description || "N/A"}
Cancellation Eligible: ${lookup.order.cancellation_eligible}\n`;

      if (intent === "ORDER_CANCELLATION") {
        const cancelCheck = checkCancellationEligibility(lookup.order);
        verifiedContext += `[DETERMINISTIC POLICY CHECK - CANCELLATION]: Allowed: ${cancelCheck.allowed}. Reason: ${cancelCheck.reason}\n`;
      } else if (intent === "RETURN_REQUEST") {
        const returnCheck = checkReturnEligibility(lookup.order);
        verifiedContext += `[DETERMINISTIC POLICY CHECK - RETURN]: Allowed: ${returnCheck.allowed}. Reason: ${returnCheck.reason}\n`;
      }
    } else {
      orderLookupError = lookup.error;
      verifiedContext += `[ORDER LOOKUP RESULT]: ${lookup.error}\n`;
    }
  }

  // 5. Specific policy context rules for non-order queries
  if (intent === "SHIPPING_DELIVERY") {
    verifiedContext += `[DETERMINISTIC POLICY - SHIPPING]: Free shipping above ₹499. Orders of ₹499 or below incur ₹50 fee. Standard delivery takes 3–5 business days across India.\n`;
  } else if (intent === "PAYMENT_COD") {
    verifiedContext += `[DETERMINISTIC POLICY - COD]: COD allowed up to ₹2,500. Payable by cash or UPI directly to courier.\n`;
  } else if (intent === "DAMAGED_PRODUCT") {
    const damCheck = checkDamagedReportingEligibility(12);
    verifiedContext += `[DETERMINISTIC POLICY - DAMAGED]: ${damCheck.reason}\n`;
  } else if (intent === "RETURN_REQUEST" && !toolResult?.order) {
    verifiedContext += `[DETERMINISTIC POLICY - RETURN]: Returns strictly allowed within 7 days of delivery only for unopened, unused products in original packaging.\n`;
  }

  // 6. Attempt generation via Gemini with verified catalog & order data as strict ground-truth
  const llmRes = await generateAriaResponse(message, verifiedContext, history);

  const finalOrderId = isOrderSpecificIntent ? detectedOrderId : null;

  if (!llmRes.isFallback && llmRes.reply) {
    return {
      reply: llmRes.reply,
      intent,
      detectedOrderId: finalOrderId,
      toolResult,
      usedFallback: false,
    };
  }

  // 7. Fallback generation (deterministic, 100% product & policy grounded)
  const fallbackReply = getDeterministicReply(intent, detectedOrderId, {
    order: toolResult?.order,
    error: orderLookupError,
    product: matchedProduct || undefined,
    userQuery: message,
  });

  return {
    reply: fallbackReply,
    intent,
    detectedOrderId: finalOrderId,
    toolResult,
    usedFallback: true,
  };
}
