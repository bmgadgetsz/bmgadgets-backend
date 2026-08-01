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
  // get phone, email and and app requestedFrom type like admin panel, frontend or vendor panel
  const { phone, email, requestedFrom } = req.query;

  // throw error if no valid email and phone
  if (!phone && !email)
    throw new ApiError(httpStatus.BAD_REQUEST, "Phone or email is required");
  if (
    (phone && typeof phone !== "string") ||
    (email && typeof email !== "string")
  )
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid phone or email format");

  // find the user by email or phone
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email: email ?? undefined }, { phone: phone ?? undefined }],
    },
    include: { role: true },
  });
  // throw error if user role and requestedFrom app type does not match
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

  // if phone exists and user does not then create a new user
  if (phone) {
    if (!user) {
      const role = await prisma.role.findFirst({ where: { isCustomer: true } });
      // role does not exists mean seed scripts was run which creates different type of roles
      if (!role)
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "The system is not configured properly. Please contact support.",
        );

      user = await prisma.user.create({
        data: { phone, email: `PLACEHOLDER#${phone}`, roleId: role.id },
        include: { role: true },
      });
    }
    // throw if user does not exist
  } else if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  // create random  otp between 10000 and 99999
  const otp = `${Math.floor(10000 + Math.random() * 90000)}`;
  // hash the otp
  const hashedOtp = await hashPassword(otp);

  // Send OTP
  if (email) {
    try {
      // send email to user
      await transporter.sendMail({
        from: env.email.user,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[SMTP] Error sending OTP email:", error);
    }
    // if phone is provided then send an an sms
  } else if (phone) {
    if (env.app.nodeEnv !== "development")
      await sendSms(message91Templates.sendOtp, phone, {
        OTP: otp,
        Duration: "5",
      });
  }

  // update the user record the hashedOtp and expiry time of otp
  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: hashedOtp,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // expires in 5 mins
    },
  });

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "OTP generated successfully",
    // Remove the truty override in production
    data: env.app.nodeEnv === "development" || true ? { otp } : undefined,
  });
});

/**
 * Log the user in after checking the otp, role and the platform requestedFrom type
 */
const login = catchAsync(async (req, res) => {
  // get the email, otp, phone and platform requestedFrom
  const { phone, email, otp, requestedFrom } = req.body;

  // throw if now email or phone
  if (!phone && !email)
    throw new ApiError(httpStatus.BAD_REQUEST, "Phone or email is required");

  // get user based on either email or phone
  const userWhereInput: Prisma.UserWhereUniqueInput = phone
    ? { phone }
    : { email };
  const user = await checkOtp({ ...userWhereInput, active: true }, otp);
  // throw if user role and platform requestedFrom does not match
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

  // send the response to client
  res.status(httpStatus.OK).json({
    success: true,
    data: {
      ...{
        ...currentUser,
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
