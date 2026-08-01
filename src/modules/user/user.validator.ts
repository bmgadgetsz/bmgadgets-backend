import { AddressSource, AddressType, Gender } from "@/generated/prisma";
import { z } from "zod";

const createUserSchema = z.object({
  body: z.strictObject({
    name: z.string().min(1, "Name is required").trim().optional(),
    phone: z.string().trim(),
    email: z.string().email("Invalid email format").trim(),
  }),
});

const updateUserSchema = z.object({
  body: z.strictObject({
    name: z.string().min(1, "Name is required").trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().email("Invalid email format").trim().optional(),
    active: z.boolean().optional(),
    otp: z.string().length(5).optional(),
    addresses: z
      .array(
        z.strictObject({
          name: z.string().min(1, "Address name is required"),
          address: z.string().min(1, "Address is required").max(100),
          primary: z.boolean().optional(),
        }),
      )
      .optional(),
    gender: z.nativeEnum(Gender).optional(),
    age: z.number().min(0).max(120).optional(),
  }),
});

const createCartItemSchema = z.object({
  body: z.strictObject({
    productVariantId: z.string().optional(),
    productComboId: z.string().optional(),
    quantity: z.number().optional(),
  }),
});

const updateCartItemSchema = z.object({
  body: z.strictObject({
    quantity: z.number(),
  }),
});

const addItemToWishListSchema = z.object({
  body: z.strictObject({
    productVariantId: z.string().optional(),
    productComboId: z.string().optional(),
  }),
});

const addressSchema = z.object({
  addressType: z.nativeEnum(AddressType),
  address: z.string().max(100),
  lat: z.number().optional(),
  lng: z.number().optional(),
  streetNumber: z.string().optional(),
  houseFlatNo: z.string(),
  road: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  zipcode: z.string(),
  placeId: z.string().optional(),
  source: z.nativeEnum(AddressSource),
  primary: z.boolean().optional(),
  active: z.boolean().optional(),
});

const createAddressSchema = z.object({
  body: addressSchema,
});

const updateAddressSchema = z.object({
  body: addressSchema.partial(),
});

const topupWalletSchema = z.object({
  body: z.strictObject({
    amount: z.number().min(1, "Amount must be at least 1"),
  }),
});

const userValidator = {
  createUserSchema,
  updateUserSchema,
  updateCartItemSchema,
  createCartItemSchema,
  addItemToWishListSchema,
  createAddressSchema,
  updateAddressSchema,
  topupWalletSchema,
};
export default userValidator;
