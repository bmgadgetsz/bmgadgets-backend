import env from "@/config/env";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import { status as httpStatus } from "http-status";
import prisma from "@/config/prisma";
import { checkOtp, hashPassword } from "@/utils/password";
import { Prisma } from "@/generated/prisma";
import transporter from "@/services/transporter.service";
import sendSms from "@/utils/sendSms";
import message91Templates from "@/config/message91Templates";
import {
  createSession,
  generateSessionToken,
  invalidateSession,
} from "./auth.service";

/**
 * Handler to generate otp for login
 */
const generateOtp = catchAsync(async (req, res) => {
  const email = (req.query.email as string)?.trim().toLowerCase();
  const requestedFrom = (req.query.requestedFrom as string) || "client";

  if (!email)
    throw new ApiError(httpStatus.BAD_REQUEST, "Email address is required");

  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { role: true },
  });

  if (user?.role.isAdmin && requestedFrom !== "admin")
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Please login from the admin portal",
    );
  if (user?.role.isVendor && requestedFrom !== "vendor")
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Please login from the vendor portal",
    );

  if (!user) {
    if (requestedFrom === "client") {
      const role = await prisma.role.findFirst({ where: { isCustomer: true } });
      if (!role)
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Customer role is not configured. Please contact support.",
        );

      user = await prisma.user.create({
        data: {
          email,
          phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          name: email.split("@")[0],
          roleId: role.id,
        },
        include: { role: true },
      });
    } else {
      throw new ApiError(httpStatus.NOT_FOUND, "User account not found");
    }
  }

  const otp = `${Math.floor(10000 + Math.random() * 90000)}`;
  const hashedOtp = await hashPassword(otp);

  try {
    await transporter.sendMail({
      from: env.email.user,
      to: email,
      subject: "Your BMGadgets Verification OTP Code",
      text: `Your OTP verification code for BMGadgets is ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #2563eb; font-weight: 800; margin-top: 0;">BMGadgets Login Code</h2>
          <p style="font-size: 14px; color: #64748b;">Use the following 5-digit verification code to complete your login:</p>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #0f172a; margin: 20px 0;">
            ${otp}
          </div>
          <p style="font-size: 12px; color: #94a3b8;">This OTP code expires in 5 minutes. If you did not request this code, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[SMTP] Error sending OTP email:", error);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: hashedOtp,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "OTP sent to your email successfully",
    data: env.app.nodeEnv === "development" ? { otp } : undefined,
  });
});

const login = catchAsync(async (req, res) => {
  const email = (req.body.email as string)?.trim().toLowerCase();
  const { otp, requestedFrom } = req.body;

  if (!email) throw new ApiError(httpStatus.BAD_REQUEST, "Email is required");

  const user = await checkOtp({ email, active: true }, otp);

  if (user.role.isCustomer && requestedFrom !== "client")
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Please login from the customer site",
    );
  if (user.role.isVendor && requestedFrom !== "vendor")
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Please login from the vendor portal",
    );

  // Generate session token and create new session
  const token = generateSessionToken();
  await createSession(token, user.id);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      customerProfileExists: !!user.customerProfile,
      hasPrimaryAddress: !!user.customerProfile?.addresses[0],
    },
  });
});

/**
 * log the user out and remove the session
 */
const logout = catchAsync(async (_req, res) => {
  // Get session ID from response locals
  const { sessionId } = res.locals.session;
  if (!sessionId) throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");

  // Invalidate the session
  await invalidateSession(sessionId);

  // send response to client
  res
    .status(httpStatus.OK)
    .json({ success: true, message: "Logout successful" });
});

/**
 * Get the current active user details according to the token sent from client
 */
const getCurrentUser = catchAsync(async (_req, res) => {
  // get current user stored in locals during previous auth middleware step
  const { currentUser } = res.locals;
  const cleanEmail = currentUser.email?.startsWith("PLACEHOLDER#")
    ? ""
    : currentUser.email;

  // send the response to client
  res.status(httpStatus.OK).json({
    success: true,
    data: {
      ...{
        ...currentUser,
        email: cleanEmail,
        gender: currentUser.customerProfile?.gender,
        age: currentUser.customerProfile?.age,
      },
      customerProfileCompleted: !!currentUser.customerProfile,
      hasPrimaryAddress: !!currentUser.customerProfile?.addresses[0],
    },
  });
});

const authController = {
  generateOtp,
  login,
  logout,
  getCurrentUser,
};
export default authController;
