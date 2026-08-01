import { z } from "zod";

const createCouponSchema = z.object({
  body: z
    .strictObject({
      title: z.string(),
      description: z.string().optional(),
      code: z.string(),
      percentageDiscount: z.number().min(1).max(100).nullable().optional(),
      flatDiscount: z.number().min(1).nullable().optional(),
      usageLimit: z.number().nullable().optional(),
      validFrom: z.string(),
      validTo: z.string(),
      minimumOrderAmount: z.number(),
      maximumDiscountCap: z.number().nullable().optional(),
      maximumOrderAmount: z.number().positive(),
      active: z.boolean(),
      categoryIds: z.array(z.string()),
    })
    .refine(
      (data) =>
        (data.flatDiscount != null && data.percentageDiscount == null) ||
        (data.flatDiscount == null && data.percentageDiscount != null),
      {
        message:
          "Provide only flatDiscount OR percentageDiscount, but not both",
      },
    )
    .transform((data) => {
      return {
        ...data,
        flatDiscount: data.flatDiscount ?? null,
        percentageDiscount: data.percentageDiscount ?? null,
      }; // This case won't occur because refine already validates
    }),
});

const updateCouponSchema = z.object({
  body: z
    .strictObject({
      title: z.string().optional(),
      description: z.string().optional(),
      code: z.string().optional(),
      percentageDiscount: z.number().min(1).max(100).nullable().optional(),
      flatDiscount: z.number().positive().nullable().optional(),
      usageLimit: z.number().nullable().optional(),
      validFrom: z.string().optional(),
      validTo: z.string().optional(),
      minimumOrderAmount: z.number().optional(),
      maximumOrderAmount: z.number().positive().optional(),

      maximumDiscountCap: z.number().optional().optional(),
      active: z.boolean().optional(),
      categoryIds: z.array(z.string()).optional(),
    })
    .refine(
      (data) =>
        (data.flatDiscount == null && data.percentageDiscount == null) ||
        (data.flatDiscount != null && data.percentageDiscount == null) ||
        (data.flatDiscount == null && data.percentageDiscount != null),
      {
        message:
          "Provide only flatDiscount OR percentageDiscount, but not both",
      },
    )
    .transform((data) => {
      return {
        ...data,
        flatDiscount: data.flatDiscount ?? null,
        percentageDiscount: data.percentageDiscount ?? null,
      }; // This case won't occur because refine already validates
    }),
});

const couponValidator = { createCouponSchema, updateCouponSchema };

export default couponValidator;
