import { Prisma, User } from "@/generated/prisma";
import { hash, verify } from "@node-rs/argon2";
import { status as httpStatus } from "http-status";
import prisma from "@/config/prisma";
import ApiError from "./ApiError";

export const hashPassword = async (password: string): Promise<string> => {
  return hash(password, {
    memoryCost: 19456, // Memory cost parameter for Argon2
    timeCost: 2, // Time cost parameter for Argon2
    outputLen: 32, // Length of the output hash
    parallelism: 1, // Degree of parallelism
  });
};

export const verifyPasswordHash = async (
  hashedPassword: string,
  password: string,
): Promise<boolean> => {
  if (!hashedPassword) return false; // Return false if no hashed password is provided
  return verify(hashedPassword, password);
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
