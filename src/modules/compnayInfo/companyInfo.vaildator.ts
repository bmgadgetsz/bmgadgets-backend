import { z } from "zod";

const updateCompanyInfoSchema = z.object({
  body: z.strictObject({
    standardShippingCost: z.number().min(0).optional(),
    shippingCostThreshold: z.number().min(0).optional(),
    thresholdActive: z.boolean().optional(),
    firstOrderFreeShipping: z.boolean().optional(),
  }),
});

const updateCompanyVendorInfoSchema = z.object({
  body: z.strictObject({
    companyAddress: z.string().optional(),
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
  }),
});

const companyInfoValidator = {
  updateCompanyInfoSchema,
  updateCompanyVendorInfoSchema,
};
export default companyInfoValidator;
