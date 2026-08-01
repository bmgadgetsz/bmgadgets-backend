import { z } from "zod";

const hsnConfigSchema = z.strictObject({
  hsnCode: z.string(),
  description: z.string(),
  gstRate: z.number(),
  active: z.boolean(),
});

const createHsnConfigSchema = z.object({
  body: hsnConfigSchema,
});

const creazteManyHsnConfigSchema = z.object({
  body: z.array(hsnConfigSchema),
});

const updateHsnConfigSchema = z.object({
  body: hsnConfigSchema.partial(),
});

const hsnConfigValidator = {
  createHsnConfigSchema,
  updateHsnConfigSchema,
  creazteManyHsnConfigSchema,
};

export default hsnConfigValidator;
