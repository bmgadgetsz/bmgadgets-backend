import { z } from "zod";

// zod schema for create category api
const createCategorySchema = z.object({
  body: z.strictObject({
    name: z
      .string()
      .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed"),
    imageUrl: z.string().url(),
    availableTags: z.array(z.string()),
    description: z.string(),
  }),
});

// zod schema for update category api
const updateCategorySchema = z.object({
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

// zod schema for create bulk categories api
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

const categoryValidator = {
  createCategorySchema,
  createManyCategoriesSchema,
  updateCategorySchema,
};
export default categoryValidator;
