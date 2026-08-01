import { z } from "zod";

// Zod schema for generate otp api
const generateOtpSchema = z.object({
  query: z.strictObject({
    phone: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    requestedFrom: z.enum(["client", "admin", "vendor"]).default("client"),
  }),
});

// zod schema for login api
const loginSchema = z.object({
  body: z.strictObject({
    phone: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    otp: z.string().length(5),
    requestedFrom: z.enum(["client", "admin", "vendor"]).default("client"),
  }),
});

const authValidator = { generateOtpSchema, loginSchema };
export default authValidator;
