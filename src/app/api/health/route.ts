import { NextResponse } from "next/server";

export async function GET() {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      brand: "Aura Skincare",
      agent: "Aria",
      version: "1.0.0",
      services: {
        geminiConfigured: hasGeminiKey,
        deterministicEngine: "active",
        orderService: "active",
        policyService: "active",
      },
    },
    { status: 200 }
  );
}
