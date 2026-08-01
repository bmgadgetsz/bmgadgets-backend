import { PrismaClient } from "@/generated/prisma";

// Initialize Prisma client with specific configuration
const prisma = new PrismaClient({
  errorFormat: "minimal", // Use minimal error format
  omit: {
    user: {
      otp: true,
      otpExpiresAt: true,
      failedOtpAttempts: true,
      lockedUntil: true,
    },
  },
});

export default prisma;
