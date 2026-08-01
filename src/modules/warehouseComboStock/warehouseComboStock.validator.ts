import { z } from "zod";

const createWarehouseComboStockSchema = z.object({
  body: z.strictObject({
    productComboId: z.string().min(1),
    warehouseId: z.string().min(1),
    comboCount: z
      .number()
      .int()
      .nonnegative({ message: "Stock must be zero or a positive integer" }),
  }),
});

const updateWarehouseComboStockSchema = z.object({
  body: z.strictObject({
    productComboId: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
    comboCount: z
      .number()
      .int()
      .nonnegative({ message: "Stock must be zero or a positive integer" })
      .optional(),
  }),
});

const warehouseComboStockValidator = {
  createWarehouseComboStockSchema,
  updateWarehouseComboStockSchema,
};

export default warehouseComboStockValidator;
