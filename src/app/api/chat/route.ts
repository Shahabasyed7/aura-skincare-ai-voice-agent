import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/validation";
import { orchestrateAgentTurn } from "@/lib/agent/agentOrchestrator";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const validation = chatRequestSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { message, history } = validation.data;
    const result = await orchestrateAgentTurn(message, history);

    return NextResponse.json(
      {
        reply: result.reply,
        intent: result.intent,
        detectedOrderId: result.detectedOrderId,
        toolResult: result.toolResult,
        usedFallback: result.usedFallback,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("API /api/chat error:", error);
    return NextResponse.json(
      {
        error: "Internal server error processing agent reply",
        reply: "I am having trouble connecting right now. Please try again or reach out to support@auraskincare.in.",
      },
      { status: 500 }
    );
  }
}
