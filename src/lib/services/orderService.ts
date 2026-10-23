import { MockOrder } from "@/types";
import { MOCK_ORDERS } from "@/lib/data/mockData";

export interface OrderLookupResult {
  success: boolean;
  order?: MockOrder;
  error?: string;
}

/**
 * Standardizes order ID input and validates format.
 * Supports:
 * - "ORD-101", "ord 101", "order 101", "sord 101"
 * - Spaced letters: "O R D 1 0 1", "o r d - 1 0 1"
 * - Spoken phrases like "order number 101" or plain "101" when in order context.
 */
export function normalizeOrderId(rawId: string): string {
  if (!rawId) return "";
  const cleaned = rawId.trim().toUpperCase();

  // Handle spaced characters like "O R D 1 0 1" or "O R D - 1 0 1"
  const unspaced = cleaned.replace(/\bO\s+R\s+D(?:\s*-\s*|\s+)?(\d)\s*(\d)\s*(\d)\b/i, "ORD-$1$2$3");
  if (/^ORD-\d{3}$/.test(unspaced)) {
    return unspaced;
  }

  // Handle patterns: ORD-101, ORD 101, ORDER 101, SORD 101, ORD#101
  const match = cleaned.match(/(?:S?ORD(?:ER)?|ORDER\s+NUMBER|ID)?[\s#-]*(\d{3})\b/i);
  if (match) {
    const candidate = `ORD-${match[1]}`;
    return candidate;
  }

  return cleaned;
}

/**
 * Extracts order ID mentions from user utterances or multi-turn history.
 * Supports:
 * - "ORD-101", "ord 101", "order 101", "sord 101"
 * - "O R D 1 0 1"
 * - Standalone "101", "102", "103" when customer answers an order prompt
 * Avoids false positives on prices (e.g. ₹499, ₹699, ₹850), dates, product sizes (30ml).
 */
export function extractOrderIdFromText(text: string, contextIndicatesOrder: boolean = false): string | null {
  if (!text) return null;

  // 1. Check for explicit spaced out letters: O R D 1 0 1
  const spacedMatch = text.match(/\bO\s+R\s+D(?:\s*-\s*|\s+)?(\d)\s*(\d)\s*(\d)\b/i);
  if (spacedMatch) {
    const candidate = `ORD-${spacedMatch[1]}${spacedMatch[2]}${spacedMatch[3]}`;
    return candidate;
  }

  // 2. Check for explicit prefix patterns: "ORD-101", "ord 101", "order 101", "order number 101", "sord 101", "ord#101"
  const prefixMatch = text.match(/\b(?:S?ORD(?:ER)?|ORDER\s+NUMBER)[\s#-]*([0-9]{3})\b/i);
  if (prefixMatch) {
    return `ORD-${prefixMatch[1]}`;
  }

  // 3. Check for any explicit "ORD-[A-Za-z0-9]+" pattern (e.g., ORD-999)
  const explicitOrd = text.match(/\bORD-([A-Za-z0-9]+)\b/i);
  if (explicitOrd) {
    return `ORD-${explicitOrd[1].toUpperCase()}`;
  }

  // 4. If conversation context indicates an order was requested (e.g. "Could you share your order number?"):
  // look for standalone digits 101, 102, 103, 999 while avoiding currency symbols (₹, Rs, INR) or size units (ml, g)
  const standaloneMatch = text.match(/(?<![₹$€£\d]|RS\.?\s*)\b(\d{3})\b(?!\s*(?:ML|G|KG|RS|RUPEES|%))/i);
  if (standaloneMatch) {
    const num = standaloneMatch[1];
    const candidate = `ORD-${num}`;
    // If context indicates order or it matches one of our known mock orders (101, 102, 103)
    if (contextIndicatesOrder || candidate in MOCK_ORDERS) {
      return candidate;
    }
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
