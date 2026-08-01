import { z } from "zod";

const createOrderItemSchema = z.object({
  body: z.strictObject({
    name: z
      .string()
      .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed"),
    imageUrl: z.string().url(),
    availableTags: z.array(z.string()),
    description: z.string(),
  }),
});

const updateOrderItemSchema = z.object({
  body: z.strictObject({
    name: z
      .string()
      .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed")
      .optional(),
    imageUrl: z.string().url().optional(),
    availableTags: z.array(z.string()).optional(),
    description: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

const createManyCategoriesSchema = z.object({
  body: z.array(
    z.strictObject({
      name: z
        .string()
        .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed")
        .optional(),
      imageUrl: z.string().url().optional(),
      availableTags: z.array(z.string()).optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
    }),
  ),
});

const orderItemValidator = {
  createOrderItemSchema,
  createManyCategoriesSchema,
  updateOrderItemSchema,
};
export default orderItemValidator;
