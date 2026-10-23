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


