import { MockOrder } from "@/types";

export const MOCK_ORDERS: Record<string, MockOrder> = {
  "ORD-101": {
    order_id: "ORD-101",
    customer_name: "Priya Sharma",
    product_name: "Vitamin C Serum 30ml",
    amount: 699,
    currency: "INR",
    status: "Out for Delivery",
    courier: "BlueDart",
    tracking_id: "BD-982103",
    expected_delivery: "By 6 PM today",
    cancellation_eligible: false,
  },
  "ORD-102": {
    order_id: "ORD-102",
    customer_name: "Rahul Verma",
    product_name: "Hydrating Sunscreen SPF 50",
    amount: 499,
    currency: "INR",
    status: "Delivered",
    courier: "Delhivery",
    tracking_id: "DL-441029",
    delivered_days_ago: 14,
    delivery_date_description: "14 days ago",
    cancellation_eligible: false,
  },
  "ORD-103": {
    order_id: "ORD-103",
    customer_name: "Ananya Patel",
    product_name: "Green Tea Face Wash + Toner",
    amount: 850,
    currency: "INR",
    status: "Processing",
    ordered_hours_ago: 3,
    cancellation_eligible: true,
  },
};

export const BRAND_KNOWLEDGE = {
  brand_name: "Aura Skincare",
  tagline: "Pure, botanical, organic Indian skincare backed by clean science",
  agent_name: "Aria",
  support_email: "support@auraskincare.in",
  operating_hours: "9:00 AM - 7:00 PM IST, Monday to Saturday",
  policies: {
    free_shipping_threshold: 499, // Orders > 499 free shipping
    standard_shipping_fee: 50, // Orders <= 499 incur Rs 50
    delivery_timeline: "3–5 business days",
    return_window_days: 7, // within 7 days of delivery for unopened, unused products in original packaging
    damaged_window_hours: 48, // within 48 hours with photos
    cod_max_limit: 2500, // Available up to Rs 2,500; cash or UPI at doorstep
    cancellation_status_allowed: "Processing",
  },
  popular_products: [
    {
      name: "Vitamin C Serum 30ml",
      price: 699,
      description: "Brightens dark spots, evens tone with Kakadu plum extract and 10% Vitamin C.",
    },
    {
      name: "Hydrating Sunscreen SPF 50",
      price: 499,
      description: "Lightweight gel sunscreen, zero white cast, broad spectrum PA++++.",
    },
    {
      name: "Green Tea Face Wash + Toner",
      price: 850,
      description: "Gentle balancing combo for oily and acne-prone skin, calming green tea extracts.",
    },
  ],
};
