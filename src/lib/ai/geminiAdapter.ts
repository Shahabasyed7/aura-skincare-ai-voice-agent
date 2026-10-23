import { GoogleGenerativeAI } from "@google/generative-ai";

let genAIClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }

  if (!genAIClient) {
    genAIClient = new GoogleGenerativeAI(apiKey.trim());
  }
  return genAIClient;
}

export const ARIA_SYSTEM_PROMPT = `
You are Aria, the AI Voice Customer Experience Agent for Aura Skincare, an Indian skincare brand.

Personality & Tone:
- Friendly, professional, calm, concise, and natural for Indian customer support.
- Speak in clear, polite English with Indian customer care warmth.
- Keep answers to 1–2 short sentences whenever possible, as your response will be spoken aloud to the customer.

Brand Policies (STRICT & UNCOMPROMISING):
1. Shipping is free on orders above ₹499. Orders of ₹499 or less incur ₹50 shipping. Standard delivery takes 3–5 business days.
2. Returns: Accepted strictly within 7 days of delivery for unopened, unused products in original packaging. If opened or beyond 7 days, returns are not permitted.
3. Damaged/Defective items: Must be reported within 48 hours of delivery with photos for replacement assistance.
4. Cancellations: Allowed ONLY while the order status is "Processing". Shipped or Out for Delivery orders CANNOT be cancelled; advise customer they may refuse delivery at the doorstep.
5. Cash on Delivery (COD): Available for orders up to ₹2,500; payable via cash or UPI to the courier delivery executive.
6. Scope: Assist strictly with Aura Skincare products and orders. Politely refuse unrelated requests (e.g. flight/hotel bookings).

Product & Order Guardrails:
- NEVER display or claim order details (such as ORD-101, ORD-102, ORD-103) during general product or purchase questions unless the customer explicitly provided an order ID for tracking, returns, or cancellations.
- NEVER invent ingredients, organic claims, or clinical benefits. If details are missing or unavailable, state: "I'm sorry, I don't have verified information about that detail right now. I can help with the product information currently available in our catalog."
- NEVER claim an order, payment, or cancellation was executed unless confirmed by the system.
- Keep answers concise so the customer can hear them effortlessly.
`.trim();

export interface LLMResponse {
  reply: string;
  isFallback: boolean;
  modelUsed?: string;
  error?: string;
}

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const GEMINI_TIMEOUT_MS = 4500;

export async function generateAriaResponse(
  userMessage: string,
  contextText: string,
  history: Array<{ sender: "customer" | "aria"; text: string }> = []
): Promise<LLMResponse> {
  const client = getGeminiClient();

  if (!client) {
    return {
      reply: "",
      isFallback: true,
      error: "GEMINI_API_KEY is not configured or empty.",
    };
  }

  try {
    const modelName = DEFAULT_GEMINI_MODEL;
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0.3,
      },
      systemInstruction: ARIA_SYSTEM_PROMPT,
    });

    const recentHistory = history.slice(-6).map((h) => ({
      role: h.sender === "customer" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    const chat = model.startChat({
      history: recentHistory,
    });

    const promptWithContext = contextText
      ? `[SYSTEM VERIFIED DATA & POLICY RULES]:\n${contextText}\n\n[CUSTOMER QUERY]:\n${userMessage}\n\nProvide Aria's 1-2 sentence spoken reply:`
      : userMessage;

    // Timeout guard to prevent blocking voice turns when rate limited or network stalled
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request timed out after ${GEMINI_TIMEOUT_MS}ms`)), GEMINI_TIMEOUT_MS)
    );

    const result = await Promise.race([
      chat.sendMessage(promptWithContext),
      timeoutPromise,
    ]);

    const text = result.response.text()?.trim();

    if (text) {
      return {
        reply: text,
        isFallback: false,
        modelUsed: modelName,
      };
    }

    return {
      reply: "",
      isFallback: true,
      error: "Empty text returned from Gemini API.",
    };
  } catch (err: unknown) {
    const errMessage = (err as Error)?.message || String(err);
    // Safe logging without exposing keys or credentials
    console.warn("[Aria Gemini Free-Quota / Error Fallback] Switching to deterministic engine:", {
      error: errMessage.slice(0, 160),
    });
    return {
      reply: "",
      isFallback: true,
      error: errMessage,
    };
  }
}
