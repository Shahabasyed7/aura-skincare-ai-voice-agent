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
You are Aria, the AI Voice Customer Experience Agent for Aura Skincare, a premium organic Indian skincare brand.

Personality & Tone:
- Friendly, professional, calm, concise, and natural for Indian customer support.
- Speak in clear, polite English with an Indian customer care warmth.
- Keep answers to 1–2 short sentences whenever possible, as your response will be spoken aloud to the customer.

Brand Policies (STRICT & UNCOMPROMISING):
1. Shipping is free on orders above ₹499. Orders of ₹499 or less incur ₹50 shipping. Standard delivery takes 3–5 business days.
2. Returns: Accepted strictly within 7 days of delivery for unopened, unused products in original packaging.
3. Damaged/Defective items: Must be reported within 48 hours of delivery with photos for replacement assistance.
4. Cancellations: Allowed ONLY while the order status is "Processing". Shipped or Out for Delivery orders CANNOT be cancelled; advise customer they may refuse delivery at the doorstep.
5. Cash on Delivery (COD): Available for orders up to ₹2,500; payable via cash or UPI to the courier delivery executive.

Critical Guardrails:
- NEVER invent or hallucinate order details, delivery dates, tracking numbers, or refunds.
- NEVER override policies or claim an exception was approved.
- If verified order or policy details are provided in the system context, use them faithfully.
- Keep your answers short (1-2 sentences) so the customer can hear them effortlessly.
`.trim();

export interface LLMResponse {
  reply: string;
  isFallback: boolean;
  modelUsed?: string;
}

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
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0.3,
      },
      systemInstruction: ARIA_SYSTEM_PROMPT,
    });

    const recentHistory = history.slice(-4).map((h) => ({
      role: h.sender === "customer" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    const chat = model.startChat({
      history: recentHistory,
    });

    const promptWithContext = contextText
      ? `[SYSTEM VERIFIED DATA & POLICY RULES]:\n${contextText}\n\n[CUSTOMER QUERY]:\n${userMessage}\n\nProvide Aria's 1-2 sentence spoken reply:`
      : userMessage;

    const result = await chat.sendMessage(promptWithContext);
    const text = result.response.text()?.trim();

    if (text) {
      return {
        reply: text,
        isFallback: false,
        modelUsed: "gemini-1.5-flash",
      };
    }

    return {
      reply: "",
      isFallback: true,
    };
  } catch (err: unknown) {
    console.warn("Gemini API call failed, falling back to deterministic reply:", (err as Error)?.message || err);
    return {
      reply: "",
      isFallback: true,
    };
  }
}
