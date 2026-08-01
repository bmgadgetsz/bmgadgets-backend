import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

/**
 * Zod validation middleware which checks if incoming payload is according to the zod schema defined
 * @param schema - the zod schema
 * @returns the parsed body and query or error
 */
const validateRequest = (schema: AnyZodObject | ZodEffects<AnyZodObject>) => {
  return async (
    req: Request,
    _: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        // Validate request body and query
        body: req.body,
        query: req.query,
      });
      req.body = parsed.body; // Update request body
      req.query = parsed.query; // Update request query
      return next(); // Proceed to next middleware
    } catch (error) {
      return next(error);
    }
  };
};

export default validateRequest;
