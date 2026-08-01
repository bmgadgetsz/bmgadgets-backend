import { Access, Resource } from "@/generated/prisma";
import { z } from "zod";

const permissionSchema = z.object({
  resource: z.nativeEnum(Resource),
  access: z.array(z.nativeEnum(Access)),
});

const createRoleSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string(),
    isCustomer: z.boolean().optional(),
    isVendor: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    active: z.boolean().optional(),
    permissions: z.array(permissionSchema).optional(),
  }),
});

const updateRoleSchema = z.object({
  body: z.strictObject({
    name: z.string().optional(),
    description: z.string().optional(),
    isCustomer: z.boolean().optional(),
    isVendor: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    active: z.boolean().optional(),
    permissions: z.array(permissionSchema).optional(),
  }),
});

const roleValidator = { createRoleSchema, updateRoleSchema };
export default roleValidator;
