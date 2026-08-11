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
  if (res.headersSent) {
    try {
      res.end();
    } catch {
      // ignore
    }
    return;
  }

  // Safe logging without throwing on circular structures
  try {
    // eslint-disable-next-line no-console
    console.error(`[APP ERROR]`, {
      endpoint: req.originalUrl || req.url,
      method: req.method,
      message: error?.message || String(error),
      stack: error?.stack,
    });
  } catch {
    // ignore logging failure
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal server error";
  let errors: unknown[] | undefined;

  // 1. ApiError or errors with custom statusCode property
  if (error?.statusCode && typeof error.statusCode === "number") {
    statusCode = error.statusCode;
    message = error.message || message;
  } else if (error?.status && typeof error.status === "number") {
    statusCode = error.status;
    message = error.message || message;
  }
  // 2. Zod Error (duck-typed for CJS bundle safety)
  else if (error?.name === "ZodError" || error instanceof ZodError || Array.isArray(error?.errors)) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation error";
    if (Array.isArray(error?.errors)) {
      errors = error.errors.map((e: any) => ({
        path: Array.isArray(e.path) ? e.path.join(".") : e.path,
        error: e.message || String(e),
      }));
    }
  }
  // 3. Prisma Known Request Error
  else if (error?.code && typeof error.code === "string" && error.code.startsWith("P")) {
    statusCode = httpStatus.BAD_REQUEST;
    message = `Database error (${error.code}): ${error.message || "Failed operation"}`;
  }
  // 4. Standard JavaScript Error
  else if (error?.message) {
    message = error.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    stack: env.app.nodeEnv === "development" ? error?.stack : undefined,
  });
};

export default globalErrorHandler;
