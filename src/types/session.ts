import { Session, User } from "@/generated/prisma";

export type SessionValidationResult =
  | {
      session: Session;
      user: Omit<
        User,
        "otp" | "otpExpiresAt" | "failedOtpAttempts" | "lockedUntil"
      >;
    }
  | { session: null; user: null };
