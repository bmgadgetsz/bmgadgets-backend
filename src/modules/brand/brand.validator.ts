import { z } from "zod";

// zod schema for create brand api
const createBrandSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
  }),
});
// zod schema for update brand api
const updateBrandSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    active: z.boolean().optional(),
  }),
});

const brandValidator = { createBrandSchema, updateBrandSchema };

export default brandValidator;
