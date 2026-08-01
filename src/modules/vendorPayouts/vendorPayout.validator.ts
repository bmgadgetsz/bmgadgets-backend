import { VendorPayoutStatus } from "@/generated/prisma";
import { z } from "zod";

const vendorPayoutItemSchema = z.strictObject({
  orderItemId: z.string().min(1, "orderItemId is required"),
  commission: z.number().min(0, "commission must be >= 0"),
  note: z.string().nullable(),
});

export const createVendorPayoutSchema = z.object({
  body: z.strictObject({
    cycleStart: z
      .string()
      .datetime("cycleStart must be a valid ISO date string"),
    cycleEnd: z.string().datetime("cycleEnd must be a valid ISO date string"),
    vendorProfileId: z.string().min(1, "vendorProfileId is required"),
  }),
});

export const updateVendorPayoutSchema = z.object({
  body: z.strictObject({
    items: z.array(vendorPayoutItemSchema).optional(),
    marketFee: z.number().optional(),
    cycleStart: z
      .string()
      .datetime("cycleStart must be a valid ISO date string")
      .optional(),
    cycleEnd: z
      .string()
      .datetime("cycleEnd must be a valid ISO date string")
      .optional(),
    finalized: z.boolean().optional(),
    status: z.nativeEnum(VendorPayoutStatus).optional(),
    vendorProfileId: z
      .string()
      .min(1, "vendorProfileId is required")
      .optional(),
  }),
});

const sendStatementEmail = z.object({
  body: z.strictObject({
    file: z.any(),
    vendorId: z.string(),
  }),
});

export const vendorPayloadValidator = {
  createVendorPayoutSchema,
  updateVendorPayoutSchema,
  sendStatementEmail,
};
