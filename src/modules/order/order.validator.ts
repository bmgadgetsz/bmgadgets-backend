import { PaymentType } from "@/generated/prisma";
import { z } from "zod";

const createOrderSchema = z.object({
  body: z.strictObject({
    couponCode: z.string().optional(),
    paymentType: z.nativeEnum(PaymentType),
  }),
});

const updateOrderSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    active: z.boolean().optional(),
  }),
});

const orderValidator = { createOrderSchema, updateOrderSchema };

export default orderValidator;
