import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty"),
  callId: z.string().optional(),
  history: z
    .array(
      z.object({
        sender: z.enum(["customer", "aria"]),
        text: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const orderLookupSchema = z.object({
  orderId: z.string().trim().min(1, "Order ID is required"),
});

export const endCallSchema = z.object({
  history: z.array(
    z.object({
      sender: z.enum(["customer", "aria"]),
      text: z.string(),
      timestamp: z.string().optional(),
    })
  ),
  detectedOrderId: z.string().nullable().optional(),
});
