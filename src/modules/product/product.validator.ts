import { Certification, ProductStatus } from "@/generated/prisma";
import { z } from "zod";

// FAQ Schema
export const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

// ProductVariant Entry
const variantSchema = z.object({
  variantId: z.string().min(1, "variantId is required"),
  discountPercentage: z.number().int().min(0).max(100).optional(),
  mfgDate: z.string(),
  expiryDate: z.string(),
  price: z.number().int().min(0, "Price must be non-negative"),
  pricePerGram: z.number().int().min(0, "Price must be non-negative"),
  weightInGrams: z.number().int().min(0, "Weight must be non-negative"),
});

const bulkVariantSchema = z.object({
  variantName: z.string().min(1, "variantId is required"),
  discountPercentage: z.number().int().min(0).max(100).optional(),
  mfgDate: z.string(),
  expiryDate: z.string(),
  price: z.number().int().min(0, "Price must be non-negative"),
  pricePerGram: z.number().int().min(0, "Price must be non-negative"),
  weightInGrams: z.number().int().min(0, "Weight must be non-negative"),
});

// Product Base Schema (for create)
const createProductSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    brandId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    hsnId: z.string().optional(),
    originCountry: z.string().optional(),

    description: z.string().optional(),
    ingredients: z.string().optional(),
    healthBenefits: z.string().optional(),
    usageInstructions: z.string().optional(),
    storageInstructions: z.string().optional(),

    certifications: z.array(z.nativeEnum(Certification)).optional(),
    thumbnailImageUrl: z.string(),
    imageUrls: z.array(z.string()).optional(),
    videoUrl: z.string().optional().nullable(),
    attributes: z.array(z.string()).optional(),
    createdById: z.string().optional(),
    productStatus: z.nativeEnum(ProductStatus).optional(),
    rejectionReason: z.string().optional(),
    categoryId: z.string().min(1, "categoryId is required"),
    featured: z.boolean().optional(),
    isFlashDeal: z.boolean().optional(),
    active: z.boolean().optional(),

    varients: z.array(variantSchema), // note: spelling should match your model
  }),
});

// Product Base Schema (for create)
const createManyProducts = z.object({
  body: z.array(
    z.strictObject({
      name: z.string(),
      brandId: z.string(),
      tags: z.array(z.string()),
      hsnId: z.string(),
      originCountry: z.string(),

      description: z.string(),
      ingredients: z.string(),
      healthBenefits: z.string(),
      usageInstructions: z.string(),
      storageInstructions: z.string(),

      certifications: z.array(z.nativeEnum(Certification)),
      thumbnailImageUrl: z.string().url(),
      imageUrls: z.array(z.string().url()),
      videoUrl: z.string().url().optional(),
      attributes: z.array(z.string()),
      categoryId: z.string().min(1, "categoryId is required"),
      featured: z.boolean().optional(),
      isFlashDeal: z.boolean().optional(),
      active: z.boolean().optional(),

      varients: z.array(bulkVariantSchema), // note: spelling should match your model
    }),
  ),
});

// Product Base Schema (for create)
const updateProductSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    brandId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    hsnId: z.string().optional(),
    originCountry: z.string().optional(),

    description: z.string().optional(),
    ingredients: z.string().optional(),
    healthBenefits: z.string().optional(),
    usageInstructions: z.string().optional(),
    storageInstructions: z.string().optional(),

    certifications: z.array(z.nativeEnum(Certification)).optional(),
    thumbnailImageUrl: z.string().url().optional(),
    imageUrls: z.array(z.string().url()).optional(),
    videoUrl: z.string().url().optional().nullable(),
    attributes: z.array(z.string()).optional(),

    createdById: z.string().optional(),
    productStatus: z.nativeEnum(ProductStatus).optional(),
    rejectionReason: z.string().optional(),
    categoryId: z.string().optional(),

    featured: z.boolean().optional(),
    isFlashDeal: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

const createProductVariantSchema = z.object({
  body: z.strictObject({
    variantId: z.string(),
    discountPercentage: z.number().int().min(0).max(100).optional(),
    mfgDate: z.string().optional(),
    expiryDate: z.string().optional(),
    price: z.number().int().min(0, "Price must be non-negative").optional(),
    pricePerGram: z.number().int().min(0, "Price must be non-negative"),
    weightInGrams: z.number().int().min(0, "Weight must be non-negative"),
  }),
});

const updateProductVariantSchema = z.object({
  body: z.strictObject({
    discountPercentage: z.number().int().min(0).max(100).optional(),
    mfgDate: z.string().optional(),
    expiryDate: z.string().optional(),
    variantId: z.string().optional(),
    price: z.number().optional(),
    pricePerGram: z.number().optional(),
    weightInGrams: z.number().optional(),
  }),
});

const comboItemSchema = z.strictObject({
  quantity: z.number().int().min(0, "Stock must be non-negative").optional(),
  productVariantId: z.string(),
});

const createProductComboSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string(),
    imageUrl: z.string().url(),
    items: z.array(comboItemSchema),
    price: z.number(),
  }),
});

const updateProductComboSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    productId: z.string().optional(),
    items: z.array(comboItemSchema).optional(),
    price: z.number().optional(),
  }),
});

export const productValidator = {
  createProductSchema,
  createManyProducts,
  updateProductSchema,
  updateProductVariantSchema,
  createProductVariantSchema,
  createProductComboSchema,
  updateProductComboSchema,
};
