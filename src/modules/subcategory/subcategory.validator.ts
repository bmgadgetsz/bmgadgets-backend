import { z } from "zod";

const createSubCategorySchema = z.object({
  body: z.strictObject({
    name: z
      .string()
      .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed"),
    description: z.string().optional(),
    categoryId: z.string(),
    active: z.boolean().optional(),
  }),
});

const updateSubCategorySchema = z.object({
  body: z.strictObject({
    name: z
      .string()
      .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed")
      .optional(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

const createManySubCategoriesSchema = z.object({
  body: z.array(
    z.strictObject({
      name: z
        .string()
        .regex(/^[A-Za-z ]+$/, "Only alphabetic characters are allowed"),
      description: z.string(),
      categoryId: z.string(),
    }),
  ),
});

const subCategoryValidator = {
  createSubCategorySchema,
  createManySubCategoriesSchema,
  updateSubCategorySchema,
};

export default subCategoryValidator;
