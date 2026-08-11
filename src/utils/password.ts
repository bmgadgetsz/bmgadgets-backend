import { Prisma, User } from "@/generated/prisma";
import crypto from "crypto";
import { status as httpStatus } from "http-status";
import prisma from "@/config/prisma";
import ApiError from "./ApiError";

export const hashPassword = async (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.pbkdf2(password, salt, 1000, 64, "sha512", (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
};

export const verifyPasswordHash = async (
  hashedPassword: string,
  password: string,
): Promise<boolean> => {
  if (!hashedPassword || !hashedPassword.includes(":")) return false;
  const [salt, key] = hashedPassword.split(":");
  return new Promise((resolve) => {
    crypto.pbkdf2(password, salt, 1000, 64, "sha512", (err, derivedKey) => {
      if (err) return resolve(false);
      resolve(derivedKey.toString("hex") === key);
    });
  });
};

export const checkOtp = async (
  where: Prisma.UserWhereUniqueInput,
  otp: string,
) => {
  const user = await prisma.user.findUnique({
    where,
    omit: {
      otp: false,
      otpExpiresAt: false,
      failedOtpAttempts: false,
      lockedUntil: false,
    },
    include: {
      customerProfile: {
        include: { addresses: { where: { primary: true, active: true } } },
      },
      role: true,
    },
  });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  // Check if account is currently locked
  if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Too many failed attempts. Try again later.",
    );
  }

  // Update this employee if not locked - reset failedOtpAttempts attempts
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedOtpAttempts: 0,
      lockedUntil: null,
    },
  });

  // Check if OTP is expired
  if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
    throw new ApiError(httpStatus.NOT_FOUND, "OTP expired");
  }

  // Verify OTP
  const passwordMatch = await verifyPasswordHash(user.otp ?? "", otp);

  if (!passwordMatch) {
    // Increment the failed attempts counter
    const failedAttempts = user.failedOtpAttempts + 1;
    const updateData: Partial<User> = { failedOtpAttempts: failedAttempts };

    // If threshold is exceeded, set lockUntil (e.g., lock for 10 minutes)
    if (failedAttempts >= 3) {
      updateData.lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    throw new ApiError(httpStatus.NOT_FOUND, "Incorrect OTP");
  }

  // On successful OTP verification, reset the counters and clear OTP fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: null,
      otpExpiresAt: null,
      failedOtpAttempts: 0,
      lockedUntil: null,
    },
  });

  return user;
};
