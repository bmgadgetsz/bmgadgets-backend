import { z } from "zod";

const createReviewSchema = z.object({
  body: z.strictObject({
    rating: z.number().positive(),
    imageUrl: z.string().url().optional(),
    message: z.string(),
    productId: z.string(),
  }),
});

const updateReviewSchema = z.object({
  body: z.strictObject({
    rating: z.number().positive().optional(),
    imageUrl: z.string().url().optional(),
    message: z.string().optional(),
    approved: z.boolean().optional(),
    productId: z.string().optional(),
  }),
});

const reviewValidator = { createReviewSchema, updateReviewSchema };

export default reviewValidator;
