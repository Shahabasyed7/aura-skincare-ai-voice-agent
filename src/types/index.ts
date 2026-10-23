export type OrderStatus = "Processing" | "Out for Delivery" | "Delivered" | "Shipped" | "Cancelled";

export interface MockOrder {
  order_id: string;
  customer_name: string;
  product_name: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  courier?: string;
  tracking_id?: string;
  expected_delivery?: string;
  delivered_days_ago?: number;
  delivery_date_description?: string;
  ordered_hours_ago?: number;
  cancellation_eligible: boolean;
}

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "responding" | "error" | "ended";

export interface TranscriptMessage {
  id: string;
  sender: "customer" | "aria";
  text: string;
  timestamp: string;
  order?: MockOrder | null;
}

export type CustomerIntent =
  | "ORDER_TRACKING"
  | "ORDER_CANCELLATION"
  | "RETURN_REQUEST"
  | "DAMAGED_PRODUCT"
  | "SHIPPING_DELIVERY"
  | "PAYMENT_COD"
  | "PRODUCT_INQUIRY"
  | "GENERAL_INQUIRY"
  | "UNKNOWN";

export type ResolutionStatus = "RESOLVED" | "POLICY_EXPLAINED" | "ESCALATED" | "INFO_REQUESTED" | "UNRESOLVED";

export interface CallSummary {
  call_id: string;
  customer_intent: CustomerIntent;
  customer_issue: string;
  order_id: string | null;
  actions_taken: string[];
  resolution_status: ResolutionStatus;
  outcome: string;
  follow_up_required: boolean;
  follow_up_details?: string;
  call_summary: string;
  transcript: Array<{ sender: "customer" | "aria"; text: string; timestamp?: string }>;
}
