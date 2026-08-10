import { z } from "zod";

// Zod schema for generate otp api
const generateOtpSchema = z.object({
  query: z.strictObject({
    email: z
      .string()
      .trim()
      .email({ message: "Valid email address is required" }),
    requestedFrom: z.enum(["client", "admin", "vendor"]).default("client"),
  }),
});

// zod schema for login api
const loginSchema = z.object({
  body: z.strictObject({
    email: z
      .string()
      .trim()
      .email({ message: "Valid email address is required" }),
    otp: z.string().length(5, { message: "OTP must be exactly 5 digits" }),
    requestedFrom: z.enum(["client", "admin", "vendor"]).default("client"),
  }),
});

const authValidator = { generateOtpSchema, loginSchema };
export default authValidator;
