import { validateSessionToken } from "@/modules/auth/auth.service";
import ApiError from "@/utils/ApiError";
import { RequestHandler } from "express";
import { status as httpStatus } from "http-status"; // Import HTTP status codes

/**
 * Authentication middle that checks if user is logged in to perform the action that follows
 * @returns the user and session if it exists else error
 */
const handleAuth = (): RequestHandler => async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from header
    if (!token)
      // Check if token is provided
      throw new ApiError(httpStatus.UNAUTHORIZED, "No token provided");

    const { session, user } = await validateSessionToken(token); // Validate token
    if (!session)
      // Check if session exists
      throw new ApiError(httpStatus.UNAUTHORIZED, "Session not found");
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found"); // Check if user exists

    res.locals.session = session;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default handleAuth;
