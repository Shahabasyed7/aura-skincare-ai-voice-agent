import { NextResponse } from "next/server";
import { endCallSchema } from "@/lib/validation";
import { generateCallSummary } from "@/lib/services/summaryService";

interface RouteParams {
  params: {
    callId: string;
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { callId } = params;
    const json = await request.json();
    const validation = endCallSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid payload for call completion",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { history, detectedOrderId } = validation.data;
    const summary = await generateCallSummary(history, detectedOrderId, callId);

    return NextResponse.json(
      {
        callId,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API /api/calls/[callId]/end error:", error);
    return NextResponse.json(
      { error: "Failed to generate call summary" },
      { status: 500 }
    );
  }
}
