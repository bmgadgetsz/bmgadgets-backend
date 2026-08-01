// src/modules/shipment/shipment.validator.ts
import { z } from "zod";

/**
 * Helper: 24-char hex ObjectId
 * adjust if you want to allow other formats
 */
// const objectId = z
//   .string()
//   .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId")
//   .or(z.string().length(24))
//   .optional();

/**
 * Query schema for list/paginate endpoints.
 * validateRequest(schema, "query") expects this shape.
 */
export const getPaginatedShipmentsSchema = z.object({
  query: z.strictObject({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    sort_by: z.string().optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    search: z.string().optional(), // matches awb / orderId / shipwayOrderId etc.
    status: z.string().optional(),
    vendorId: z.string().optional(),
    isReturn: z.coerce.boolean().optional(), // accepts "true"/"false" or boolean
    createdAtFrom: z.string().optional(), // ISO date string expected
    createdAtTo: z.string().optional(),
    orderId: z.string().optional(),
    awb: z.string().optional(),
  }),
});

/**
 * Request body schema for update endpoint.
 * validateRequest(schema) expects this shape for body by default.
 * We use strictObject to forbid unexpected fields.
 */
export const updateShipmentSchema = z.object({
  body: z
    .strictObject({
      status: z.string().optional(),
      awb: z.string().optional().nullable(),
      carrierId: z.string().optional().nullable(),
      pickupId: z.string().optional().nullable(),
      labelUrl: z.string().url().optional().nullable(),
      shipwayMeta: z.any().optional(), // JSON from webhook / shipway
      allocations: z.any().optional(), // keep flexible
      isReturn: z.boolean().optional(),
      originalShipmentId: z.string().optional(),
      // avoid allowing id / createdAt / updatedAt etc
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "At least one field must be provided to update",
    }),
});

/**
 * If you want a dedicated validator for route params (e.g. :id)
 * and for by-order endpoints, you can add these:
 */
export const getByIdParamsSchema = z.object({
  params: z.strictObject({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId"),
  }),
});

export const getByOrderParamsSchema = z.object({
  params: z.strictObject({
    orderId: z.string(),
  }),
});

const shipmentValidator = {
  getPaginatedShipmentsSchema,
  updateShipmentSchema,
  getByIdParamsSchema,
  getByOrderParamsSchema,
};

export default shipmentValidator;
