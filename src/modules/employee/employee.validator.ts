import { z } from "zod";

const userSchema = z.strictObject({
  name: z.string().optional(),
  email: z.string().email(),
  phone: z.string(),
  roleId: z.string(),
});

const createEmployeeSchema = z.object({
  body: userSchema,
});

const updateEmployeeSchema = z.object({
  body: userSchema.partial(),
});

const brandValidator = { createEmployeeSchema, updateEmployeeSchema };

export default brandValidator;
