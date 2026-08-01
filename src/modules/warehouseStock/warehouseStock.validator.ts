import { z } from "zod";

const createWarehouseStockSchema = z.object({
  body: z.strictObject({
    productVariantId: z.string().min(1),
    warehouseId: z.string().min(1),
    productCount: z
      .number()
      .int()
      .nonnegative({ message: "Stock must be zero or a positive integer" }),
  }),
});

const updateWarehouseStockSchema = z.object({
  body: z.strictObject({
    productVariantId: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
    productCount: z
      .number()
      .int()
      .nonnegative({ message: "Stock must be zero or a positive integer" })
      .optional(),
  }),
});

const warehouseStockValidator = {
  createWarehouseStockSchema,
  updateWarehouseStockSchema,
};

export default warehouseStockValidator;
