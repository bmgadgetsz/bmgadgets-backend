import { RefundMethod, RefundStatus } from "@/generated/prisma";
import { z } from "zod";

const BankInfoSchema = z.strictObject({
  acNo: z.string(),
  acHolderName: z.string(),
  ifsc: z.string(),
});

const returnRequestSchema = z.strictObject({
  orderItemId: z.string(),
  quantity: z.number().int(),
  reason: z.string(),
  imageUrls: z.array(z.string().url()),
  refundMethod: z.nativeEnum(RefundMethod),
  bankInfo: BankInfoSchema.optional(),
  status: z.nativeEnum(RefundStatus).optional(),
  rejectReason: z.string().optional(),
  detailedReason: z.string().optional(),
  adminNote: z.string().optional(),
  enableReturnIdempotency: z.boolean().optional(),
});

const createReturnRequestSchema = z.object({
  body: returnRequestSchema,
});

const updateReturnRequestSchema = z.object({
  body: returnRequestSchema
    .extend({
      pickupAddressId: z.string().transform((_val) => undefined),
    })
    .partial(),
});

const returnRequestValidator = {
  createReturnRequestSchema,
  updateReturnRequestSchema,
};

export default returnRequestValidator;
