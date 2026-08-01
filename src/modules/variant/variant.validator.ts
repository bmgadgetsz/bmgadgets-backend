import { z } from "zod";

const createVariantSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string(),
    subCategoryId: z.string(),
  }),
});

const updateVariantSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    description: z.string().optional(),
    subCategoryId: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

const variantValidator = {
  createVariantSchema,
  updateVariantSchema,
};

export default variantValidator;
