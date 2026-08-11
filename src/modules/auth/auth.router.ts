import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { status as httpStatus } from "http-status";
import handleAuth from "@/middleware/handleAuth";
import env from "@/config/env";
import authValidator from "./auth.validator";
import authController from "./auth.controller";

// Rate limiter configuration for generating OTP change
const generateOtpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: "draft-8", // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: { trustProxy: false, xForwardedForHeader: false },
  keyGenerator: (req) => {
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (typeof xForwardedFor === "string") {
      return xForwardedFor.split(",")[0].trim();
    }
    return req.ip || "127.0.0.1";
  },
  handler: (_, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Please wait before requesting a new code",
    });
  },
});

// auth router instance
const authRouter = Router();

// generate otp for login
authRouter.get(
  "/generate-otp",
  env.app.nodeEnv !== "development"
    ? generateOtpLimiter
    : (_req, _res, next) => next(),
  validateRequest(authValidator.generateOtpSchema),
  authController.generateOtp,
);

// login for customer, vendor and admins
authRouter.post(
  "/login",
  validateRequest(authValidator.loginSchema),
  authController.login,
);
// logout api
authRouter.post("/logout", handleAuth(), authController.logout);
// get current active user based on token sent from client
authRouter.get("/current-user", handleAuth(), authController.getCurrentUser);

export default authRouter;
