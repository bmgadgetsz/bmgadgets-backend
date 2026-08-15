import { PaymentType } from "@/generated/prisma";
import { z } from "zod";

const createOrderSchema = z.object({
  body: z.object({
    couponCode: z.string().optional(),
    paymentType: z.nativeEnum(PaymentType),
    customer: z
      .object({
        name: z.string().min(1, "Customer full name is required"),
        phone: z.string().min(10, "Customer valid phone number is required"),
        email: z.string().optional(),
      })
      .optional(),
    address: z
      .object({
        addressType: z.enum(["HOME", "OFFICE", "OTHER"]).optional(),
        address: z.string().min(1, "Delivery address is required"),
        houseFlatNo: z.string().optional(),
        road: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zipcode: z.string().min(6, "Valid 6-digit zipcode is required"),
      })
      .optional(),
    items: z
      .array(
        z.object({
          productVariantId: z.string().optional(),
          productComboId: z.string().optional(),
          quantity: z.number().positive(),
        }),
      )
      .optional(),
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
