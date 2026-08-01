import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import ApiError from "@/utils/ApiError";
import env from "@/config/env";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import httpStatus from "http-status"; // Import HTTP status codes

/**
 * This is a global error handler which handles all caught and uncaught errors
 * @param error - the error thrown (like ApiError, PrismaClient errors etc)
 * @param req - request object
 * @param res - response object
 * @param _next - next function to pass the error
 */
const globalErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // eslint-disable-next-line no-console
  // log the exact error and request
  console.log(`[APP ERROR]`, {
    // Log error details
    endpoint: req.url,
    method: req.method,
    payload: JSON.stringify(req.body),
    headers: req.headers,
    error,
  });

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR; // Default status code
  let message = "Internal server error"; // Default error message
  let errors: unknown[] | undefined; // Error details

  // Handle various types of errors and respective error messages
  if (error instanceof ApiError) {
    statusCode = error?.statusCode;
    message = error.message;
  } else if (error instanceof PrismaClientKnownRequestError) {
    message =
      "Oops! Something went wrong with the database. Please try again in a moment.";
  } else if (error instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation error";
    errors = error.errors.map((e) => ({ path: e.path, error: e.message }));
  } else if (error instanceof Error) {
    message = error?.message;
  }

  // send response to client
  res.status(statusCode).json({
    // Send error response
    success: false,
    message,
    errors,
    stack: env.app.nodeEnv === "development" ? error?.stack : undefined, // Include stack trace in development
  });
};

export default globalErrorHandler;
