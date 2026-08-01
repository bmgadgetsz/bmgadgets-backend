import { z } from "zod";

const createWarehouseSchema = z.object({
  body: z.strictObject({
    title: z.string().min(2, "Title must be at least 2 characters"),
    company: z.string().min(1, "Company title is reuired"),
    contactPersonName: z.string().min(2, "Contact person name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(5, "Phone must be valid"),
    phonePrint: z.string().optional(),
    address1: z.string().min(2, "Address1 is required"),
    address2: z.string().optional(),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    country: z.string().min(2, "Country is required"),
    pincode: z.string().min(3, "Pincode must be valid"),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    gstNo: z.string(),
    fssaiCode: z.string().optional(),
    vendorId: z.string().min(1, "VendorId is required"),
    shipwayWarehouseId: z.string().optional(),
  }),
});

const updateWarehouseSchema = z.object({
  body: z.strictObject({
    title: z.string().min(2).optional(),
    company: z.string().min(1).optional(),
    contactPersonName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    phonePrint: z.string().optional(),
    address1: z.string().min(2).optional(),
    address2: z.string().optional(),
    city: z.string().min(2).optional(),
    state: z.string().min(2).optional(),
    country: z.string().min(2).optional(),
    pincode: z.string().min(3).optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    gstNo: z.string(),
    fssaiCode: z.string().optional(),
    vendorId: z.string().optional(),
    shipwayWarehouseId: z.string().optional(),
  }),
});

const createWarehouseVariantStockSchema = z.object({
  body: z.strictObject({
    productVariantId: z.string().min(1, "warehouseId is required"),
    warehouseId: z.string().min(1, "variantId is required"),
    productCount: z.number().min(1),
  }),
});

const createWarehouseComboStockSchema = z.object({
  body: z.strictObject({
    productComboId: z.string().min(1, "warehouseId is required"),
    warehouseId: z.string().min(1, "variantId is required"),
    comboCount: z.number().min(1),
  }),
});

const updateWarehouseVariantStockSchema = z.object({
  body: z.strictObject({
    productVariantId: z.string().min(1, "warehouseId is required").optional(),
    warehouseId: z.string().min(1, "variantId is required").optional(),
    productCount: z.number().min(1).optional(),
  }),
});

const updateWarehouseComboStockSchema = z.object({
  body: z.strictObject({
    productComboId: z.string().min(1, "warehouseId is required").optional(),
    warehouseId: z.string().min(1, "variantId is required").optional(),
    comboCount: z.number().min(1).optional(),
  }),
});

const warehouseValidator = {
  createWarehouseSchema,
  updateWarehouseSchema,

  createWarehouseVariantStockSchema,
  updateWarehouseVariantStockSchema,

  createWarehouseComboStockSchema,
  updateWarehouseComboStockSchema,
};

export default warehouseValidator;
