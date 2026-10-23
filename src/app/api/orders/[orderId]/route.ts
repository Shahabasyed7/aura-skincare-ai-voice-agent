import { NextResponse } from "next/server";
import { get_order_details } from "@/lib/services/orderService";

interface RouteParams {
  params: {
    orderId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { orderId } = params;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID parameter is required" }, { status: 400 });
    }

    const result = get_order_details(orderId);
    if (!result.success || !result.order) {
      return NextResponse.json(
        {
          error: result.error || "Order not found",
          orderId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ order: result.order }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to retrieve order" }, { status: 500 });
  }
}
