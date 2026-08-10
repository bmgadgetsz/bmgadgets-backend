import { PaymentType } from "@/generated/prisma";
import { z } from "zod";

const createOrderSchema = z.object({
  body: z.strictObject({
    couponCode: z.string().optional(),
    paymentType: z.nativeEnum(PaymentType),
  }),
});

const updateOrderSchema = z.object({
  body: z.object({
    status: z
      .enum([
        "PENDING",
        "INITIALIZED",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "PAID",
        "CANCELLED",
      ])
      .optional(),
    fulfillmentMode: z.enum(["MANUAL", "SHIPWAY"]).optional(),
    deliveryPartner: z.string().optional(),
    trackingId: z.string().optional(),
    trackingUrl: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
  }),
});

const orderValidator = { createOrderSchema, updateOrderSchema };

export default orderValidator;
