import { z } from "zod";

const comboItemSchema = z.object({
  quantity: z.number().int().min(1),
  productVariantId: z.string(),
});

const createProductComboSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string(),
    imageUrl: z.string().url(),
    productId: z.string(),
    items: z.array(comboItemSchema),
    price: z.number().int().min(0),
    weightInGrams: z.number().int().min(0),
  }),
});

const updateProductComboSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    active: z.boolean().optional(),
    productId: z.string().optional(),
    items: z.array(comboItemSchema).optional(),
    price: z.number().int().min(0).optional(),
    weightInGrams: z.number().int().min(0).optional(),
  }),
});

const productComboValidator = {
  createProductComboSchema,
  updateProductComboSchema,
};

export default productComboValidator;
