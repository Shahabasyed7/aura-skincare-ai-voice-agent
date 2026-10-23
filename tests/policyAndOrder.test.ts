import { describe, it, expect } from "vitest";
import { get_order_details, normalizeOrderId, extractOrderIdFromText } from "@/lib/services/orderService";
import {
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamagedReportingEligibility,
  checkCodEligibility,
} from "@/lib/services/policyService";
import { orchestrateAgentTurn, getProductDeterministicAnswer } from "@/lib/agent/agentOrchestrator";
import { generateDeterministicSummary } from "@/lib/services/summaryService";
import { selectAriaVoice, isLikelyFemaleVoice } from "@/lib/services/voiceService";
import { formatTranscriptTimestamp } from "@/components/CallSummaryView";
import { MockOrder } from "@/types";

describe("Order Service & Normalization Regression Suite", () => {
  it("retrieves valid orders ORD-101, ORD-102, ORD-103 correctly", () => {
    const res101 = get_order_details("ORD-101");
    expect(res101.success).toBe(true);
    expect(res101.order?.customer_name).toBe("Priya Sharma");
    expect(res101.order?.status).toBe("Out for Delivery");
    expect(res101.order?.courier).toBe("BlueDart");
    expect(res101.order?.tracking_id).toBe("BD-982103");
    expect(res101.order?.expected_delivery?.toLowerCase()).toBe("by 6 pm today");

    const res102 = get_order_details("ORD-102");
    expect(res102.success).toBe(true);
    expect(res102.order?.customer_name).toBe("Rahul Verma");
    expect(res102.order?.status).toBe("Delivered");

    const res103 = get_order_details("ORD-103");
    expect(res103.success).toBe(true);
    expect(res103.order?.customer_name).toBe("Ananya Patel");
    expect(res103.order?.status).toBe("Processing");
  });

  // Requirement 1 & 6: Typed ORD-101 with tracking request
  it("handles typed 'ORD-101' with a tracking request", async () => {
    const turn = await orchestrateAgentTurn("I want to track ORD-101", []);
    expect(turn.intent).toBe("ORDER_TRACKING");
    expect(turn.detectedOrderId).toBe("ORD-101");
    expect(turn.toolResult?.success).toBe(true);
    expect(turn.reply).toContain("BlueDart");
    expect(turn.reply).toContain("BD-982103");
    expect(turn.reply.toLowerCase()).toContain("by 6 pm today");
  });

  // Requirement 2: Spoken/transcribed 'order 101'
  it("normalizes and tracks spoken 'order 101'", async () => {
    const id = extractOrderIdFromText("can you track order 101 please");
    expect(id).toBe("ORD-101");
    const turn = await orchestrateAgentTurn("can you track order 101 please", []);
    expect(turn.detectedOrderId).toBe("ORD-101");
    expect(turn.reply).toContain("BD-982103");
  });

  // Requirement 3: 'sord 101'
  it("normalizes 'sord 101' when context clearly indicates order ID", () => {
    const id = extractOrderIdFromText("my number is sord 101");
    expect(id).toBe("ORD-101");
  });

  // Requirement 4: Spaced speech transcription 'O R D 1 0 1'
  it("normalizes spaced transcription 'O R D 1 0 1'", () => {
    const id = extractOrderIdFromText("check status for O R D 1 0 1");
    expect(id).toBe("ORD-101");
  });

  // Requirement 5: Asking to track an order, then providing its ID in the next turn
  it("preserves tracking context across turns when user provides ID in turn 2", async () => {
    const history = [
      { sender: "customer" as const, text: "I want to track my order." },
      { sender: "aria" as const, text: "Of course! Could you please share your order number?" },
    ];
    const turn2 = await orchestrateAgentTurn("ORD-101", history);
    expect(turn2.intent).toBe("ORDER_TRACKING");
    expect(turn2.detectedOrderId).toBe("ORD-101");
    expect(turn2.toolResult?.success).toBe(true);
    expect(turn2.reply).toContain("BD-982103");
  });

  // Avoid false positives on prices, sizes, or dates
  it("does not accidentally match product sizes, prices, or dates as order IDs", () => {
    expect(extractOrderIdFromText("I bought a 100ml serum for 500 rupees")).toBeNull();
    expect(extractOrderIdFromText("Will it arrive in 3 days?")).toBeNull();
  });

  // Requirement 9: Unknown order ORD-999 is not fabricated
  it("safely handles unknown order ORD-999 without fabricating details", async () => {
    const res = get_order_details("ORD-999");
    expect(res.success).toBe(false);
    expect(res.order).toBeUndefined();

    const turn = await orchestrateAgentTurn("track ORD-999", []);
    expect(turn.detectedOrderId).toBe("ORD-999");
    expect(turn.reply).toContain("could not find any order with ID ORD-999");
  });
});

describe("Cancellation Policy Rules (Requirement 8)", () => {
  it("ORD-103 cancellation succeeds only while status is Processing", () => {
    const res103 = get_order_details("ORD-103");
    expect(res103.order?.status).toBe("Processing");
    const check = checkCancellationEligibility(res103.order!);
    expect(check.allowed).toBe(true);
    expect(check.reason).toContain("eligible for cancellation");
  });

  it("ORD-101 cancellation is rejected because it is Out for Delivery", () => {
    const res101 = get_order_details("ORD-101");
    expect(res101.order?.status).toBe("Out for Delivery");
    const check = checkCancellationEligibility(res101.order!);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("refuse delivery at the doorstep");
  });
});

describe("Return Policy Rules (Requirement 7 & 10)", () => {
  it("ORD-102 return request correctly rejects request outside 7-day window (delivered 14 days ago)", () => {
    const res102 = get_order_details("ORD-102");
    expect(res102.order?.status).toBe("Delivered");
    expect(res102.order?.delivered_days_ago).toBe(14);
    const check = checkReturnEligibility(res102.order!);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("exceeds our 7-day return window");
  });

  it("follows policy for: 'I opened this product 20 days ago; can I return it?'", async () => {
    const turn = await orchestrateAgentTurn("I opened this product 20 days ago; can I return it?", []);
    expect(turn.intent).toBe("RETURN_REQUEST");
    expect(turn.reply.toLowerCase()).toContain("7");
    expect(turn.reply.toLowerCase()).toContain("unopened");
  });
});

describe("Out of Scope Scope Detection (Requirement 11)", () => {
  it("identifies 'Book a flight to Goa' as outside scope and politely declines", async () => {
    const turn = await orchestrateAgentTurn("Book a flight to Goa", []);
    expect(turn.intent).toBe("UNKNOWN");
    expect(turn.reply.toLowerCase()).toContain("unable to assist with external bookings");
    expect(turn.reply).not.toContain("booked");
  });
});

describe("Shipping & COD Policies", () => {
  it("charges ₹50 shipping on ₹499 or less, and free shipping strictly above ₹499", () => {
    expect(calculateShippingFee(499).isFree).toBe(false);
    expect(calculateShippingFee(499).fee).toBe(50);
    expect(calculateShippingFee(500).isFree).toBe(true);
    expect(calculateShippingFee(500).fee).toBe(0);
  });

  it("enforces COD up to ₹2500 only", () => {
    expect(checkCodEligibility(2500).allowed).toBe(true);
    expect(checkCodEligibility(2501).allowed).toBe(false);
  });

  it("enforces 48-hour damaged product window with photos", () => {
    expect(checkDamagedReportingEligibility(48).allowed).toBe(true);
    expect(checkDamagedReportingEligibility(49).allowed).toBe(false);
  });
});

describe("Call Summary & Resolution Accuracy (Requirement 14 & 15)", () => {
  it("marks call UNRESOLVED when Aria has not delivered an answer", () => {
    const transcript = [
      { sender: "customer" as const, text: "Where is ORD-101?" },
    ];
    const summary = generateDeterministicSummary(transcript, "ORD-101", "call_test_1");
    expect(summary.resolution_status).toBe("UNRESOLVED");
    expect(summary.outcome).toContain("Customer disconnected or query was not completed.");
  });

  it("marks introductory turn as UNRESOLVED when customer only asked general capabilities", () => {
    const transcript = [
      { sender: "customer" as const, text: "My name is Shahaba. How can you assist me today?" },
      { sender: "aria" as const, text: "Hello! I am Aria from Aura Skincare. How can I assist you with your orders, shipping, or skincare products today?" },
    ];
    const summary = generateDeterministicSummary(transcript, null, "call_test_intro");
    expect(summary.resolution_status).toBe("UNRESOLVED");
    expect(summary.customer_intent).toBe("GENERAL_INQUIRY");
    expect(summary.outcome).toContain("Aria explained available support areas; customer has not yet completed a specific inquiry.");
  });

  it("marks call RESOLVED when successful tracking details were delivered by Aria", () => {
    const transcript = [
      { sender: "customer" as const, text: "Where is ORD-101?" },
      { sender: "aria" as const, text: "Your order ORD-101 is Out for Delivery with BlueDart (tracking ID BD-982103) and expected by 6 PM today." },
    ];
    const summary = generateDeterministicSummary(transcript, "ORD-101", "call_test_2");
    expect(summary.resolution_status).toBe("RESOLVED");
    expect(summary.actions_taken).toContain("Communicated courier and tracking information to customer");
    expect(summary.outcome).toContain("BlueDart tracking ID BD-982103");
  });
});

describe("Aria Voice Selection (Requirement 16 & 17)", () => {
  it("prioritizes Microsoft Heera (en-IN) when available", () => {
    const mockVoices = [
      { name: "Microsoft David Desktop", lang: "en-US", voiceURI: "david" } as SpeechSynthesisVoice,
      { name: "Microsoft Heera - English (India)", lang: "en-IN", voiceURI: "heera" } as SpeechSynthesisVoice,
      { name: "Microsoft Zira Desktop", lang: "en-US", voiceURI: "zira" } as SpeechSynthesisVoice,
    ];
    const chosen = selectAriaVoice(mockVoices);
    expect(chosen?.name).toContain("Heera");
  });

  it("falls back to female en-IN voice if Heera is not installed", () => {
    const mockVoices = [
      { name: "Microsoft David", lang: "en-US", voiceURI: "david" } as SpeechSynthesisVoice,
      { name: "Google Neerja", lang: "en-IN", voiceURI: "neerja" } as SpeechSynthesisVoice,
    ];
    const chosen = selectAriaVoice(mockVoices);
    expect(chosen?.name).toContain("Neerja");
  });

  it("falls back to general English female voice if no en-IN is available", () => {
    const mockVoices = [
      { name: "Microsoft David", lang: "en-US", voiceURI: "david" } as SpeechSynthesisVoice,
      { name: "Microsoft Zira - English (United States)", lang: "en-US", voiceURI: "zira" } as SpeechSynthesisVoice,
    ];
    const chosen = selectAriaVoice(mockVoices);
    expect(chosen?.name).toContain("Zira");
  });

  it("handles empty voice list gracefully without throwing", () => {
    const chosen = selectAriaVoice([]);
    expect(chosen).toBeNull();
  });
});

describe("Phase 3: Multi-turn Product Intelligence & Pronoun Resolution Suite", () => {
  it("executes the exact 6-turn product reasoning conversation", async () => {
    // Turn 1: Customer asks about Green Tea Face Wash
    const history1: { sender: "customer" | "aria"; text: string }[] = [];
    const turn1 = await orchestrateAgentTurn("Tell me about the Green Tea Face Wash.", history1);
    expect(turn1.intent).toBe("PRODUCT_INQUIRY");
    expect(turn1.reply.toLowerCase()).toContain("green tea");
    expect(turn1.reply.toLowerCase()).not.toContain("welcome to aura skincare"); // Not a generic brand greeting

    history1.push({ sender: "customer", text: "Tell me about the Green Tea Face Wash." });
    history1.push({ sender: "aria", text: turn1.reply });

    // Turn 2: Customer asks "What ingredients does it contain?"
    const turn2 = await orchestrateAgentTurn("What ingredients does it contain?", history1);
    expect(turn2.intent).toBe("PRODUCT_INQUIRY");
    expect(turn2.reply.toLowerCase()).toContain("green tea extract");

    history1.push({ sender: "customer", text: "What ingredients does it contain?" });
    history1.push({ sender: "aria", text: turn2.reply });

    // Turn 3: Customer asks "How often should I use it?"
    const turn3 = await orchestrateAgentTurn("How often should I use it?", history1);
    expect(turn3.intent).toBe("PRODUCT_INQUIRY");
    expect(turn3.reply.toLowerCase()).toMatch(/twice daily|daily/);

    history1.push({ sender: "customer", text: "How often should I use it?" });
    history1.push({ sender: "aria", text: turn3.reply });

    // Turn 4: Customer asks "Can I use it with the Vitamin C Serum?"
    const turn4 = await orchestrateAgentTurn("Can I use it with the Vitamin C Serum?", history1);
    expect(turn4.intent).toBe("PRODUCT_INQUIRY");
    expect(turn4.reply.toLowerCase()).toMatch(/yes|compatible|cleanser/);

    history1.push({ sender: "customer", text: "Can I use it with the Vitamin C Serum?" });
    history1.push({ sender: "aria", text: turn4.reply });

    // Turn 5: Customer asks "What about its price?"
    const turn5 = await orchestrateAgentTurn("What about its price?", history1);
    expect(turn5.intent).toBe("PRODUCT_INQUIRY");
    expect(turn5.reply).toMatch(/ORD-103|850|349/);

    history1.push({ sender: "customer", text: "What about its price?" });
    history1.push({ sender: "aria", text: turn5.reply });

    // Turn 6: Customer switches intent: "Actually, track my order."
    const turn6 = await orchestrateAgentTurn("Actually, track my order.", history1);
    expect(turn6.intent).toBe("ORDER_TRACKING");
    expect(turn6.reply.toLowerCase()).toMatch(/order id|order number|tracking/);
  });

  it("handles Vitamin C Serum product questions specifically", async () => {
    const turn = await orchestrateAgentTurn("Tell me about the Vitamin C Serum", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply).toContain("Vitamin C Serum");
    expect(turn.reply).toContain("₹699");
  });

  it("handles Hydrating Sunscreen SPF 50 inquiries specifically", async () => {
    const turn = await orchestrateAgentTurn("Tell me about the Hydrating Sunscreen SPF 50", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply).toContain("Hydrating Sunscreen");
    expect(turn.reply).toContain("₹499");
  });

  it("handles Toner inquiries and clarifies its relationship to the ORD-103 bundle", async () => {
    const turn = await orchestrateAgentTurn("Tell me about the Toner", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply).toContain("Toner");
    expect(turn.reply).toContain("ORD-103");
  });

  // Test Failure 1: "can I get more information about skin care products of Arya"
  it("resolves Failure 1: 'can I get more information about skin care products of Arya' to product introduction", async () => {
    const turn = await orchestrateAgentTurn("can I get more information about skin care products of Arya", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply.toLowerCase()).toContain("vitamin c serum");
    expect(turn.reply.toLowerCase()).toContain("green tea face wash");
    expect(turn.reply.toLowerCase()).toContain("hydrating sunscreen");
    expect(turn.reply.toLowerCase()).not.toContain("how can i assist you with your orders, shipping, or skincare products today"); // not generic greeting
  });

  // Test Failure 2: "can you help me with product questions"
  it("resolves Failure 2: 'can you help me with product questions' by introducing product catalog rather than repeating greeting", async () => {
    const turn = await orchestrateAgentTurn("can you help me with product questions", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply.toLowerCase()).toContain("vitamin c");
    expect(turn.reply.toLowerCase()).toContain("sunscreen");
    expect(turn.reply.toLowerCase()).not.toContain("how can i assist you with your orders, shipping, or skincare products today");
  });

  // Test Failure 3: "I want to knows can care products"
  it("resolves Failure 3: 'I want to knows can care products' (phonetic STT speech) to product catalog introduction", async () => {
    const turn = await orchestrateAgentTurn("I want to knows can care products", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply.toLowerCase()).toContain("vitamin c serum");
    expect(turn.reply.toLowerCase()).toContain("green tea face wash");
  });

  // Multi-turn: Ask what products Aura sells -> receive introduction -> ask for more information -> follow-up on price
  it("handles multi-turn product discovery and 'tell me more' context resolution", async () => {
    const history: { sender: "customer" | "aria"; text: string }[] = [];
    
    // Turn 1: Product overview
    const turn1 = await orchestrateAgentTurn("What products does Aura sell?", history);
    expect(turn1.intent).toBe("PRODUCT_INQUIRY");
    expect(turn1.reply).toContain("Vitamin C Serum");
    expect(turn1.reply).toContain("Hydrating Sunscreen");

    history.push({ sender: "customer", text: "What products does Aura sell?" });
    history.push({ sender: "aria", text: turn1.reply });

    // Turn 2: Follow-up on one product
    const turn2 = await orchestrateAgentTurn("Tell me more about the Hydrating Sunscreen", history);
    expect(turn2.intent).toBe("PRODUCT_INQUIRY");
    expect(turn2.reply).toContain("Hydrating Sunscreen");
    expect(turn2.reply).toContain("₹499");

    history.push({ sender: "customer", text: "Tell me more about the Hydrating Sunscreen" });
    history.push({ sender: "aria", text: turn2.reply });

    // Turn 3: "What about its price?"
    const turn3 = await orchestrateAgentTurn("What about its price?", history);
    expect(turn3.intent).toBe("PRODUCT_INQUIRY");
    expect(turn3.reply).toContain("₹499");

    history.push({ sender: "customer", text: "What about its price?" });
    history.push({ sender: "aria", text: turn3.reply });

    // Turn 4: Switch from product inquiry to tracking ORD-101
    const turn4 = await orchestrateAgentTurn("Can you track my order ORD-101 now?", history);
    expect(turn4.intent).toBe("ORDER_TRACKING");
    expect(turn4.detectedOrderId).toBe("ORD-101");
    expect(turn4.reply).toContain("BD-982103");
  });

  // Query about unverified ingredients
  it("handles ingredients not present in the catalog without making false claims", async () => {
    const turn = await orchestrateAgentTurn("Does the Green Tea Face Wash contain retinol or salicylic acid?", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply.toLowerCase()).toContain("does not contain retinol");
    expect(turn.reply.toLowerCase()).toContain("green tea extract");
  });

  // Genuinely unclear speech / acoustic noise
  it("clarifies politely when input is genuinely unclear noise or gibberish", async () => {
    const turn = await orchestrateAgentTurn("uh hmm", []);
    expect(turn.intent).toBe("UNKNOWN");
    expect(turn.reply.toLowerCase()).toContain("didn't quite catch that");
  });
});

describe("Section 6: Final Assessment 12 Critical Scenarios Suite", () => {
  // Scenario 1: Product inquiry -> follow-up price question -> purchase intent
  // Scenario 2: "I want to buy it" correctly resolves product from context & clarifies bundle vs individual
  // Scenario 3: "Can you repeat that?" repeats the previous response
  // Scenario 4: Switching products updates context without restarting the conversation
  it("executes Scenario 1-4: product inquiry -> price follow-up -> purchase intent -> repeat -> product switch", async () => {
    const history: { sender: "customer" | "aria"; text: string }[] = [];

    // Turn 1: Customer asks about Green Tea Face Wash
    const turn1 = await orchestrateAgentTurn("Tell me about Green Tea Face Wash.", history);
    expect(turn1.intent).toBe("PRODUCT_INQUIRY");
    expect(turn1.reply.toLowerCase()).toContain("green tea");
    expect(turn1.reply.toLowerCase()).not.toContain("how can i assist you with your orders");

    history.push({ sender: "customer", text: "Tell me about Green Tea Face Wash." });
    history.push({ sender: "aria", text: turn1.reply });

    // Turn 2: Customer asks "What's its price?" (pronoun 'its' refers to Green Tea Face Wash)
    const turn2 = await orchestrateAgentTurn("What's its price?", history);
    expect(turn2.intent).toBe("PRODUCT_INQUIRY");
    expect(turn2.reply).toContain("Green Tea Face Wash");
    expect(turn2.reply).toMatch(/unavailable|850|bundle/i);

    history.push({ sender: "customer", text: "What's its price?" });
    history.push({ sender: "aria", text: turn2.reply });

    // Turn 3: Customer says "I want to buy it." (Scenario 2: purchase intent resolves product & clarifies bundle vs individual)
    const turn3 = await orchestrateAgentTurn("I want to buy it.", history);
    expect(turn3.intent).toBe("PRODUCT_INQUIRY");
    expect(turn3.reply).toContain("Green Tea Face Wash");
    expect(turn3.reply).toContain("850");
    expect(turn3.reply.toLowerCase()).toContain("bundle");
    // Does not falsely confirm an order was placed
    expect(turn3.reply.toLowerCase()).not.toMatch(/order confirmed|placed your order|payment received/i);

    history.push({ sender: "customer", text: "I want to buy it." });
    history.push({ sender: "aria", text: turn3.reply });

    // Turn 4: Customer says "Can you repeat that?" (Scenario 3: repeats previous response)
    const turn4 = await orchestrateAgentTurn("Can you repeat that?", history);
    expect(turn4.reply.toLowerCase()).toContain("certainly");
    expect(turn4.reply).toContain(turn3.reply);

    history.push({ sender: "customer", text: "Can you repeat that?" });
    history.push({ sender: "aria", text: turn4.reply });

    // Turn 5: Customer changes to another product (Scenario 4: switches context correctly without restarting)
    const turn5 = await orchestrateAgentTurn("What about the Vitamin C Serum?", history);
    expect(turn5.intent).toBe("PRODUCT_INQUIRY");
    expect(turn5.reply).toContain("Vitamin C Serum");
    expect(turn5.reply).toContain("699");
    expect(turn5.reply.toLowerCase()).not.toContain("how can i assist you with your orders"); // No repeated greeting
  });

  // Scenario 5: ORD-101 tracking returns exact stored data
  it("Scenario 5: ORD-101 tracking returns exact stored data", async () => {
    const turn = await orchestrateAgentTurn("Where is ORD-101?", []);
    expect(turn.intent).toBe("ORDER_TRACKING");
    expect(turn.detectedOrderId).toBe("ORD-101");
    expect(turn.toolResult?.success).toBe(true);
    expect(turn.toolResult?.order?.customer_name).toBe("Priya Sharma");
    expect(turn.reply).toContain("Vitamin C Serum");
    expect(turn.reply.toLowerCase()).toContain("out for delivery");
    expect(turn.reply).toContain("BlueDart");
    expect(turn.reply).toContain("BD-982103");
    expect(turn.reply.toLowerCase()).toContain("by 6 pm today");
  });

  // Scenario 6: ORD-999 produces a polite invalid-order response
  it("Scenario 6: ORD-999 produces a polite invalid-order response", async () => {
    const turn = await orchestrateAgentTurn("Can you track ORD-999?", []);
    expect(turn.detectedOrderId).toBe("ORD-999");
    expect(turn.reply.toLowerCase()).toContain("could not find any order with id ord-999");
    expect(turn.reply.toLowerCase()).not.toMatch(/delivered|out for delivery|shipped/i);
  });

  // Scenario 7: ORD-103 cancellation is eligible, but no false cancellation confirmation is made
  it("Scenario 7: ORD-103 cancellation is eligible without false cancellation confirmation", async () => {
    const orderDetails = get_order_details("ORD-103");
    expect(orderDetails.success).toBe(true);
    expect(orderDetails.order?.status).toBe("Processing");
    const policyCheck = checkCancellationEligibility(orderDetails.order!);
    expect(policyCheck.allowed).toBe(true);

    const turn = await orchestrateAgentTurn("Can I cancel ORD-103?", []);
    expect(turn.intent).toBe("ORDER_CANCELLATION");
    expect(turn.reply.toLowerCase()).toContain("eligible for cancellation");
    // Ensure no false confirmation that the order is already cancelled
    expect(turn.reply.toLowerCase()).not.toContain("your order has been cancelled");
    expect(turn.reply.toLowerCase()).not.toContain("refund has been processed");
  });

  // Scenario 8: Return after 20 days for an opened product is refused
  it("Scenario 8: Return after 20 days for an opened product is refused", async () => {
    const turn = await orchestrateAgentTurn("I opened this product 20 days ago, can I return it?", []);
    expect(turn.intent).toBe("RETURN_REQUEST");
    expect(turn.reply.toLowerCase()).toContain("7 days");
    expect(turn.reply.toLowerCase()).toContain("unopened");
  });

  // Scenario 9: Damaged item policy is explained accurately (48h + photos)
  it("Scenario 9: Damaged item policy is explained accurately (within 48 hours with photos)", async () => {
    const turn = await orchestrateAgentTurn("My product arrived damaged in the box. What should I do?", []);
    expect(turn.intent).toBe("DAMAGED_PRODUCT");
    expect(turn.reply).toContain("48 hours");
    expect(turn.reply.toLowerCase()).toContain("photo");
    expect(turn.reply.toLowerCase()).toContain("replacement");
  });

  // Scenario 10: Out-of-scope request is politely declined
  it("Scenario 10: Out-of-scope request is politely declined", async () => {
    const turn = await orchestrateAgentTurn("Can you book a flight to Mumbai for me?", []);
    expect(turn.intent).toBe("UNKNOWN");
    expect(turn.reply.toLowerCase()).toContain("unable to assist with external bookings");
    expect(turn.reply.toLowerCase()).not.toContain("flight booked");
  });

  // Scenario 11: Product-only transcript generates PRODUCT_INQUIRY summary without a fabricated order ID
  it("Scenario 11: Product-only transcript generates PRODUCT_INQUIRY summary with null order ID", () => {
    const transcript = [
      { sender: "customer" as const, text: "Tell me about Green Tea Face Wash." },
      { sender: "aria" as const, text: "Our Green Tea Face Wash is a gentle cleanser formulated with organic green tea extract. It is offered in our Green Tea Face Wash + Toner bundle for ₹850 as featured in order ORD-103." },
      { sender: "customer" as const, text: "What's its price?" },
      { sender: "aria" as const, text: "Green Tea Face Wash is available as part of our Green Tea Face Wash + Toner bundle for ₹850. Individual standalone price is currently unavailable." },
      { sender: "customer" as const, text: "I want to buy it." },
      { sender: "aria" as const, text: "Our Green Tea Face Wash is available in the Green Tea Face Wash + Toner bundle for ₹850. Would you like to proceed with the bundle, or are you looking for an individual product?" },
    ];

    const summary = generateDeterministicSummary(transcript, null, "call_prod_test");
    expect(summary.customer_intent).toBe("PRODUCT_INQUIRY");
    expect(summary.order_id).toBeNull();
    expect(summary.actions_taken).toContain("Shared product information from catalog");
    expect(summary.resolution_status).toBe("RESOLVED");
  });

  // Scenario 12: Unknown product details do not produce invented claims or prices
  it("Scenario 12: Unknown product details do not produce invented claims or prices", () => {
    const answer = getProductDeterministicAnswer(
      {
        id: "toner",
        name: "Toner",
        category: "Toner",
        size: "100ml",
        priceDescription: "Available in our bundle for ₹850.",
        description: "A refreshing toner.",
        purposeAndBenefits: ["Refreshes skin"],
        ingredients: [],
        directions: { routinePlacement: "After cleansing", frequency: "Daily", instructions: "Apply gently" },
        skinTypeSuitability: ["All skin types"],
        precautions: ["Avoid eyes"],
        faqs: [],
        compatibility: { compatibleWith: [], notes: "" },
        storageAndShelfLife: "Cool place",
        commonTroubleshooting: [],
        returnAndReplacementRules: "7 days",
        disclaimer: "Cosmetic",
      },
      "What ingredients are in the toner?"
    );
    expect(answer).toBe(
      "I'm sorry, I don't have verified information about that detail right now. I can help with the product information currently available in our catalog."
    );
  });
});

describe("Section 7: Order Card Isolation & Audited Catalog Regressions", () => {
  it("does not attach order details or orderId during general product questions", async () => {
    const turn = await orchestrateAgentTurn("Tell me about Green Tea Face Wash.", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.detectedOrderId).toBeNull();
    expect(turn.toolResult?.order).toBeUndefined();
  });

  it("does not attach order details or orderId during purchase inquiries (e.g. 'I want to buy it')", async () => {
    const history = [
      { sender: "customer" as const, text: "Tell me about Green Tea Face Wash." },
      { sender: "aria" as const, text: "Our Green Tea Face Wash is available in our bundle for ₹850." },
    ];
    const turn = await orchestrateAgentTurn("I want to buy it.", history);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.detectedOrderId).toBeNull();
    expect(turn.toolResult?.order).toBeUndefined();
  });

  it("attaches order details only when user explicitly asks to track or references an order ID", async () => {
    const turn = await orchestrateAgentTurn("Can you track my order ORD-103?", []);
    expect(turn.intent).toBe("ORDER_TRACKING");
    expect(turn.detectedOrderId).toBe("ORD-103");
    expect(turn.toolResult?.order).toBeDefined();
    expect(turn.toolResult?.order?.customer_name).toBe("Ananya Patel");
    expect(turn.toolResult?.order?.status).toBe("Processing");
  });

  it("states information is unavailable when queried on unverified ingredients for sunscreen or toner", async () => {
    const turn = await orchestrateAgentTurn("What are the ingredients in the Hydrating Sunscreen?", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply).toContain("I'm sorry, I don't have verified information about that detail right now");
  });

  it("does not make unsupported organic claims in product descriptions", async () => {
    const turn = await orchestrateAgentTurn("Tell me about your toner.", []);
    expect(turn.intent).toBe("PRODUCT_INQUIRY");
    expect(turn.reply.toLowerCase()).not.toContain("organic");
    expect(turn.reply.toLowerCase()).not.toContain("miracle");
    expect(turn.reply.toLowerCase()).not.toContain("cure");
  });
});

describe("Section 8: 5 Verified Bug Fixes Regressions", () => {
  // Bug 1: Post-call summary incorporates complete history and reflects mixed/unresolved topics
  it("Bug 1: captures primary intent, secondary topics (ORD-102 return refusal, ORD-999 failure, flight request), and marks UNRESOLVED", () => {
    const mixedTranscript = [
      { sender: "customer" as const, text: "Can you track my order ORD-101?" },
      { sender: "aria" as const, text: "Your order ORD-101 for Vitamin C Serum 30ml is out for delivery with BlueDart (Tracking ID: BD-982103) and is expected by 6 PM today." },
      { sender: "customer" as const, text: "Also, I bought ORD-102 and opened it 20 days ago. Can I return it?" },
      { sender: "aria" as const, text: "Regarding returns for ORD-102: Returns are only accepted within 7 days of delivery for unopened products. Because delivery occurred 14 days ago, it cannot be returned." },
      { sender: "customer" as const, text: "What about my friend's order ORD-999?" },
      { sender: "aria" as const, text: "I could not find any order with ID ORD-999. Please verify your order number." },
      { sender: "customer" as const, text: "Can you book a flight to Goa for me?" },
      { sender: "aria" as const, text: "I can only assist with Aura Skincare orders and products. I am unable to assist with flights." },
    ];

    const summary = generateDeterministicSummary(mixedTranscript, "ORD-101", "call_mixed_test");

    // Primary intent identified
    expect(summary.customer_intent).toBe("ORDER_TRACKING");
    // Order ID field represents all touched orders
    expect(summary.order_id).toContain("ORD-101");
    expect(summary.order_id).toContain("ORD-102");
    expect(summary.order_id).toContain("ORD-999");
    // Actions include primary and secondary topics
    expect(summary.actions_taken).toContain("Communicated courier and tracking information to customer");
    expect(summary.actions_taken).toContain("Evaluated return eligibility for ORD-102 against 7-day unopened policy");
    expect(summary.actions_taken).toContain("Attempted order lookup for ORD-999 (not found in database)");
    // Because ORD-999 lookup failed and flight was unsupported, resolution_status MUST NOT be blanket RESOLVED
    expect(summary.resolution_status).toBe("UNRESOLVED");
    // Summary text mentions secondary topics
    expect(summary.call_summary.toLowerCase()).toContain("ord-102");
    expect(summary.call_summary.toLowerCase()).toContain("ord-999");
  });

  // Bug 2: Recap timestamp formatting handles valid, time-string, and invalid/missing gracefully
  it("Bug 2: formatTranscriptTimestamp handles ISO dates, 12-hour strings, missing, and invalid values safely", () => {
    // 12-hour format string (as emitted by useVoiceAgent)
    expect(formatTranscriptTimestamp("01:23:45 AM")).toBe("01:23:45 AM");
    expect(formatTranscriptTimestamp("02:15 PM")).toBe("02:15 PM");

    // ISO string or parseable date string
    const isoResult = formatTranscriptTimestamp("2026-10-24T01:30:00.000Z");
    expect(isoResult).not.toBe("Invalid Date");
    expect(isoResult).toMatch(/\d{1,2}:\d{2}/);

    // Empty, undefined or null
    expect(formatTranscriptTimestamp("")).toBe("");
    expect(formatTranscriptTimestamp(undefined)).toBe("");

    // Invalid non-date string
    const invalidResult = formatTranscriptTimestamp("random_text");
    expect(invalidResult).toBe("random_text");
    expect(invalidResult).not.toBe("Invalid Date");
  });

  // Bug 3: Multi-question query in one turn resolves both cancellation and return correctly
  it("Bug 3: detects and answers both cancellation and return questions in one message with correct order context", async () => {
    const history = [
      { sender: "customer" as const, text: "Can you track ORD-101?" },
      { sender: "aria" as const, text: "Your order ORD-101 is Out for Delivery." },
    ];

    const turn = await orchestrateAgentTurn(
      "Can I cancel it? I bought ORD-102 and opened it 20 days ago. Can I return it?",
      history
    );

    // Both questions answered in the same reply
    expect(turn.reply.toLowerCase()).toContain("cancellation");
    expect(turn.reply.toLowerCase()).toContain("return");

    // Correct context: ORD-101 is out for delivery and cannot be cancelled
    expect(turn.reply).toContain("ORD-101");
    expect(turn.reply.toLowerCase()).toContain("cannot be cancelled");

    // Correct context: ORD-102 is outside 7 days and opened, so ineligible for return
    expect(turn.reply).toContain("ORD-102");
    expect(turn.reply.toLowerCase()).toContain("outside the 7-day return window");
    expect(turn.reply.toLowerCase()).toContain("not eligible for a return");
    expect(turn.reply.toLowerCase()).not.toContain("is eligible for a return");
  });

  // Bug 3: Does not treat an unrelated order ID as the order being cancelled
  it("Bug 3: does not confuse cancellation target when multiple orders are mentioned", async () => {
    const turn = await orchestrateAgentTurn(
      "Can I cancel order ORD-103? Also, can I return ORD-102?",
      []
    );
    // ORD-103 should be evaluated for cancellation (Processing -> eligible)
    expect(turn.reply).toContain("ORD-103");
    expect(turn.reply.toLowerCase()).toContain("eligible for cancellation");

    // ORD-102 should be evaluated for return (14 days ago -> ineligible)
    expect(turn.reply).toContain("ORD-102");
    expect(turn.reply.toLowerCase()).toContain("delivered 14 days ago");
  });

  // Bug 5: Voice selection prioritizes Indian English (en-IN) female voices, especially Heera and Neerja
  it("Bug 5: prioritizes Heera and Neerja en-IN voices, falls back to female, then any English safely", () => {
    const voicesWithNeerja = [
      { name: "Google US English", lang: "en-US", voiceURI: "us" } as SpeechSynthesisVoice,
      { name: "Microsoft Neerja - English (India)", lang: "en-IN", voiceURI: "neerja" } as SpeechSynthesisVoice,
      { name: "Microsoft David", lang: "en-US", voiceURI: "david" } as SpeechSynthesisVoice,
    ];
    const pickedNeerja = selectAriaVoice(voicesWithNeerja);
    expect(pickedNeerja?.name).toContain("Neerja");

    const voicesWithVeena = [
      { name: "Google US English", lang: "en-US", voiceURI: "us" } as SpeechSynthesisVoice,
      { name: "Veena - English (India)", lang: "en-IN", voiceURI: "veena" } as SpeechSynthesisVoice,
      { name: "Microsoft Mark", lang: "en-US", voiceURI: "mark" } as SpeechSynthesisVoice,
    ];
    const pickedVeena = selectAriaVoice(voicesWithVeena);
    expect(pickedVeena?.name).toContain("Veena");

    const foreignFemaleOnly = [
      { name: "Microsoft David", lang: "en-US", voiceURI: "david" } as SpeechSynthesisVoice,
      { name: "Microsoft Zira", lang: "en-US", voiceURI: "zira" } as SpeechSynthesisVoice,
    ];
    const pickedZira = selectAriaVoice(foreignFemaleOnly);
    expect(pickedZira?.name).toContain("Zira");

    const genericOnly = [
      { name: "Default Voice", lang: "en-US", voiceURI: "def" } as SpeechSynthesisVoice,
    ];
    const pickedGeneric = selectAriaVoice(genericOnly);
    expect(pickedGeneric?.name).toBe("Default Voice");

    expect(selectAriaVoice([])).toBeNull();
  });
});

  // Section 9: Remaining Verified Bug Fixes Regressions
  describe("Section 9: Remaining Verified Bug Fixes Regressions", () => {
    // 1. Post-call summary completeness & wording (ORD-101, ORD-102, ORD-103)
    it("Summary: includes all orders touched (ORD-101, ORD-102, ORD-103), order_id field represents all orders, and no contradictory wording", () => {
      const mixedTranscript = [
        { sender: "aria" as const, text: "Namaste, I am Aria from Aura Skincare. How can I help you today?" },
        { sender: "customer" as const, text: "Can you track ORD-101 for me?" },
        { sender: "aria" as const, text: "Your order ORD-101 for Vitamin C Serum 30ml is out for delivery with BlueDart (Tracking ID: BD-982103) and is expected By 6 PM today." },
        { sender: "customer" as const, text: "Can I return ORD-102? It was delivered 14 days ago and opened." },
        { sender: "aria" as const, text: "Order ORD-102 was delivered 14 days ago, which exceeds our 7-day return window. We cannot accept returns beyond 7 days of delivery." },
        { sender: "customer" as const, text: "Can I cancel ORD-103?" },
        { sender: "aria" as const, text: "Order ORD-103 is currently Processing and is eligible for cancellation." },
      ];

      const summary = generateDeterministicSummary(mixedTranscript, "ORD-101", "call_mixed_test");

      // Verify all touched orders are present in order_id field and order_ids array
      expect(summary.order_id).toContain("ORD-101");
      expect(summary.order_id).toContain("ORD-102");
      expect(summary.order_id).toContain("ORD-103");
      expect(summary.order_ids).toContain("ORD-101");
      expect(summary.order_ids).toContain("ORD-102");
      expect(summary.order_ids).toContain("ORD-103");

      // Actions taken reflects ORD-103 cancellation check
      expect(summary.actions_taken).toContain("Checked cancellation eligibility for ORD-103");

      // Summary text covers secondary topics accurately
      expect(summary.call_summary).toContain("ORD-101");
      expect(summary.call_summary).toContain("ORD-102");
      expect(summary.call_summary).toContain("ORD-103");

      // Never claim an order was cancelled unless confirmed
      expect(summary.outcome.toLowerCase()).not.toContain("order was cancelled");
      expect(summary.call_summary.toLowerCase()).not.toContain("cancellation confirmed");

      // Follow-up required is false when all policies were safely explained/resolved, so no contradictory UNRESOLVED + No follow-up needed
      expect(summary.resolution_status).toBe("POLICY_EXPLAINED");
      expect(summary.follow_up_required).toBe(false);
    });

    // 2. Correct return-policy handling when no order ID is provided
    it("Return policy: explains 7-day unopened policy when user says 'I bought this 20 days ago and have opened it' without forcing order ID", async () => {
      const turn = await orchestrateAgentTurn(
        "I bought this 20 days ago and have opened it. Can I return it?",
        []
      );

      expect(turn.intent).toBe("RETURN_REQUEST");
      // Does not force user to provide an order ID first
      expect(turn.reply.toLowerCase()).not.toContain("please share your order id");
      expect(turn.reply.toLowerCase()).not.toContain("please provide your order number");
      // Explains policy: 7 days, unopened, unused
      expect(turn.reply.toLowerCase()).toContain("7 days");
      expect(turn.reply.toLowerCase()).toContain("unopened");
      // States it falls outside the return policy
      expect(turn.reply.toLowerCase()).toContain("outside our return policy");
      // Does not claim an order lookup occurred
      expect(turn.detectedOrderId).toBeNull();
    });

    // 3. Spoken-style order ID normalization
    it("Order ID: recognizes spoken-style 'order one zero one' and normalizes to ORD-101 without off-topic classification", async () => {
      expect(normalizeOrderId("order one zero one")).toBe("ORD-101");
      expect(normalizeOrderId("ord one zero two")).toBe("ORD-102");
      expect(normalizeOrderId("order one zero three")).toBe("ORD-103");

      const turn = await orchestrateAgentTurn("Can you track order one zero one?", []);
      expect(turn.intent).toBe("ORDER_TRACKING");
      expect(turn.detectedOrderId).toBe("ORD-101");
      expect(turn.reply).toContain("ORD-101");
      expect(turn.reply).toContain("BlueDart");
    });

    // 4. Refund demand handling without false promises
    it("Refund demand: handles 'I want a ₹5,000 refund' appropriately without promising refunds or inventing timelines", async () => {
      const turn = await orchestrateAgentTurn("I want a ₹5,000 refund right now", []);
      expect(turn.intent).toBe("RETURN_REQUEST");
      // Explains return conditions required for refunds
      expect(turn.reply.toLowerCase()).toContain("refund");
      expect(turn.reply.toLowerCase()).toContain("7 days");
      // Does not promise or grant a refund
      expect(turn.reply.toLowerCase()).not.toContain("your refund of ₹5,000 will be credited");
      expect(turn.reply.toLowerCase()).not.toContain("we have initiated your refund");
    });

    // 5. Product copy quality (no garbled 'formulated for Suitable for')
    it("Product copy: avoids garbled 'formulated for Suitable for' and presents clean, grounded answer", async () => {
      const turn = await orchestrateAgentTurn("Is Hydrating Sunscreen safe for sensitive skin types?", []);
      expect(turn.intent).toBe("PRODUCT_INQUIRY");
      expect(turn.reply).not.toContain("formulated for Suitable for");
      expect(turn.reply).toContain("suitable for everyday use");
      expect(turn.reply).toContain("patch test");
    });
  });



