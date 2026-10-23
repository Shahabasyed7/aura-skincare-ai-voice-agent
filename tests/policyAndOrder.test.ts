import { describe, it, expect } from "vitest";
import { get_order_details, normalizeOrderId } from "@/lib/services/orderService";
import {
  calculateShippingFee,
  checkCancellationEligibility,
  checkReturnEligibility,
  checkDamagedReportingEligibility,
  checkCodEligibility,
} from "@/lib/services/policyService";
import { MockOrder } from "@/types";

describe("Order Service", () => {
  it("retrieves valid orders ORD-101, ORD-102, ORD-103 correctly", () => {
    const res101 = get_order_details("ORD-101");
    expect(res101.success).toBe(true);
    expect(res101.order?.customer_name).toBe("Priya Sharma");
    expect(res101.order?.status).toBe("Out for Delivery");

    const res102 = get_order_details("ORD-102");
    expect(res102.success).toBe(true);
    expect(res102.order?.customer_name).toBe("Rahul Verma");
    expect(res102.order?.status).toBe("Delivered");

    const res103 = get_order_details("ORD-103");
    expect(res103.success).toBe(true);
    expect(res103.order?.customer_name).toBe("Ananya Patel");
    expect(res103.order?.status).toBe("Processing");
  });

  it("handles normalized variants like 'ord101' and '103'", () => {
    const res = get_order_details("ord101");
    expect(res.success).toBe(true);
    expect(res.order?.order_id).toBe("ORD-101");

    const res2 = get_order_details("103");
    expect(res2.success).toBe(true);
    expect(res2.order?.order_id).toBe("ORD-103");
  });

  it("safely handles unknown order IDs without fabricating data", () => {
    const res = get_order_details("ORD-999");
    expect(res.success).toBe(false);
    expect(res.order).toBeUndefined();
    expect(res.error).toContain("could not find any order with ID ORD-999");
  });
});

describe("Cancellation Policy Rules", () => {
  it("allows cancellation when order status is Processing", () => {
    const processingOrder: MockOrder = {
      order_id: "ORD-103",
      customer_name: "Ananya Patel",
      product_name: "Green Tea Face Wash + Toner",
      amount: 850,
      currency: "INR",
      status: "Processing",
      cancellation_eligible: true,
    };
    const check = checkCancellationEligibility(processingOrder);
    expect(check.allowed).toBe(true);
    expect(check.reason).toContain("eligible for cancellation");
  });

  it("rejects cancellation for Out for Delivery orders and advises refusal at doorstep", () => {
    const outOrder: MockOrder = {
      order_id: "ORD-101",
      customer_name: "Priya Sharma",
      product_name: "Vitamin C Serum",
      amount: 699,
      currency: "INR",
      status: "Out for Delivery",
      cancellation_eligible: false,
    };
    const check = checkCancellationEligibility(outOrder);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("cannot be cancelled");
    expect(check.reason).toContain("refuse delivery at the doorstep");
  });

  it("rejects cancellation for Shipped orders", () => {
    const shippedOrder: MockOrder = {
      order_id: "ORD-500",
      customer_name: "Test Customer",
      product_name: "Test Serum",
      amount: 500,
      currency: "INR",
      status: "Shipped",
      cancellation_eligible: false,
    };
    const check = checkCancellationEligibility(shippedOrder);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("cannot be cancelled");
  });
});

describe("Return Policy Rules", () => {
  const deliveredOrder: MockOrder = {
    order_id: "ORD-102",
    customer_name: "Rahul Verma",
    product_name: "Hydrating Sunscreen SPF 50",
    amount: 499,
    currency: "INR",
    status: "Delivered",
    delivered_days_ago: 14,
    cancellation_eligible: false,
  };

  it("rejects return if delivered 14 days ago (> 7 days)", () => {
    const check = checkReturnEligibility(deliveredOrder);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("exceeds our 7-day return window");
  });

  it("allows return if delivered 3 days ago (<= 7 days)", () => {
    const check = checkReturnEligibility(deliveredOrder, 3);
    expect(check.allowed).toBe(true);
    expect(check.reason).toContain("within the 7-day return window");
    expect(check.reason).toContain("unopened, unused");
  });

  it("allows return on exact boundary of 7 days", () => {
    const check = checkReturnEligibility(deliveredOrder, 7);
    expect(check.allowed).toBe(true);
  });

  it("rejects return on boundary of 8 days", () => {
    const check = checkReturnEligibility(deliveredOrder, 8);
    expect(check.allowed).toBe(false);
  });
});

describe("Damaged Product Reporting Window", () => {
  it("allows replacement assistance within 48 hours with photos", () => {
    const check = checkDamagedReportingEligibility(24);
    expect(check.allowed).toBe(true);
    expect(check.reason).toContain("within the 48-hour window");
    expect(check.reason).toContain("photos");
  });

  it("allows reporting at exact 48 hours", () => {
    const check = checkDamagedReportingEligibility(48);
    expect(check.allowed).toBe(true);
  });

  it("rejects automated replacement assistance when reported at 49 hours", () => {
    const check = checkDamagedReportingEligibility(49);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("must be reported within 48 hours");
  });
});

describe("Shipping Fee Boundary Conditions", () => {
  it("charges ₹50 shipping on ₹499 (exact boundary rule: ₹499 or less)", () => {
    const check = calculateShippingFee(499);
    expect(check.isFree).toBe(false);
    expect(check.fee).toBe(50);
  });

  it("charges ₹50 shipping on amounts below ₹499 (e.g. ₹299)", () => {
    const check = calculateShippingFee(299);
    expect(check.isFree).toBe(false);
    expect(check.fee).toBe(50);
  });

  it("qualifies for FREE shipping on ₹500 (above ₹499)", () => {
    const check = calculateShippingFee(500);
    expect(check.isFree).toBe(true);
    expect(check.fee).toBe(0);
  });

  it("qualifies for FREE shipping on higher amounts (e.g. ₹699)", () => {
    const check = calculateShippingFee(699);
    expect(check.isFree).toBe(true);
    expect(check.fee).toBe(0);
  });
});

describe("Cash on Delivery (COD) Policy", () => {
  it("allows COD for orders up to ₹2,500 (e.g. ₹2,500)", () => {
    const check = checkCodEligibility(2500);
    expect(check.allowed).toBe(true);
    expect(check.reason).toContain("cash or UPI");
  });

  it("rejects COD for orders above ₹2,500 (e.g. ₹2,501)", () => {
    const check = checkCodEligibility(2501);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("only available for orders up to ₹2500");
  });
});
