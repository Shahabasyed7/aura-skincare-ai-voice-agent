import { NextResponse } from "next/server";
import { getAllOrders } from "@/lib/services/orderService";

export async function GET() {
  try {
    const orders = getAllOrders();
    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to retrieve orders" }, { status: 500 });
  }
}
