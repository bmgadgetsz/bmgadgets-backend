import { validateSessionToken } from "@/modules/auth/auth.service";
import ApiError from "@/utils/ApiError";
import { RequestHandler } from "express";
import { status as httpStatus } from "http-status"; // Import HTTP status codes

/**
 * Authentication middle that checks if user is logged in to perform the action that follows
 * @returns the user and session if it exists else error
 */
/**
 * Authentication middleware that checks if user is logged in to perform the action that follows.
 * If options.optional is true, proceeding without a valid token will not throw an error and res.locals.currentUser will remain undefined.
 */
const handleAuth = (options?: { optional?: boolean }): RequestHandler => async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from header
    if (!token) {
      if (options?.optional) return next();
      throw new ApiError(httpStatus.UNAUTHORIZED, "No token provided");
    }

    const { session, user } = await validateSessionToken(token); // Validate token
    if (!session) {
      if (options?.optional) return next();
      throw new ApiError(httpStatus.UNAUTHORIZED, "Session not found");
    }
    if (!user) {
      if (options?.optional) return next();
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    res.locals.session = session;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    if (options?.optional) return next();
    next(error);
  }
};

export default handleAuth;
