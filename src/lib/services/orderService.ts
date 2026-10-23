import { MockOrder } from "@/types";
import { MOCK_ORDERS, BRAND_KNOWLEDGE } from "@/lib/data/mockData";

export interface OrderLookupResult {
  success: boolean;
  order?: MockOrder;
  error?: string;
}

/**
 * Standardizes order ID input and validates format
 */
export function normalizeOrderId(rawId: string): string {
  if (!rawId) return "";
  const cleaned = rawId.trim().toUpperCase();
  // Support variations like "ORD 101", "ORD101", "101"
  const match = cleaned.match(/(?:ORD[- ]?)?(\d{3})/i);
  if (match) {
    return `ORD-${match[1]}`;
  }
  return cleaned;
}

/**
 * Extracts order ID mentions from text (e.g., "Where is my order ORD-101?")
 */
export function extractOrderIdFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(?:ORD[- ]?)?(\d{3})\b/i);
  if (match) {
    const normalized = `ORD-${match[1]}`;
    if (normalized in MOCK_ORDERS) {
      return normalized;
    }
  }
  const explicitMatch = text.match(/\bORD-\w+\b/i);
  if (explicitMatch) {
    return explicitMatch[0].toUpperCase();
  }
  return null;
}

/**
 * get_order_details(order_id)
 * Validates ID and retrieves the corresponding mock order.
 * Unknown IDs return a clear, safe error rather than fabricated data.
 */
export function get_order_details(order_id: string): OrderLookupResult {
  const normalizedId = normalizeOrderId(order_id);
  
  if (!normalizedId) {
    return {
      success: false,
      error: "Please provide a valid order ID (e.g., ORD-101).",
    };
  }

  const order = MOCK_ORDERS[normalizedId];
  if (!order) {
    return {
      success: false,
      error: `I could not find any order with ID ${normalizedId}. Please verify your order number.`,
    };
  }

  return {
    success: true,
    order,
  };
}

/**
 * Retrieves all mock orders for the evaluator/helper panel
 */
export function getAllOrders(): MockOrder[] {
  return Object.values(MOCK_ORDERS);
}
