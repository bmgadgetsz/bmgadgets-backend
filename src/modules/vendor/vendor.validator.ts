import { VendorOnboardingStatus } from "@/generated/prisma";
import { z } from "zod";

const vendorRegisterSchema = z.object({
  body: z.strictObject({
    businessName: z.string().min(2),
    natureOfBusiness: z.string(),
    contactPersonName: z.string().min(2),
    email: z.string().email(),
    mobileNumber: z.string().min(10),
    alternateMobile: z.string().optional(),
    companyOwnerName: z.string().optional(),
    companyAddress: z.string().max(100).optional(),
    authorizedRepresentative: z.string().optional(),
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
    fssaiLicenseNumber: z.string().optional(),
    accountHolderName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankIfsc: z.string().optional(),
    bankName: z.string().optional(),
    manufacturingLicenseNumber: z.string().optional(),
    storageLicenseNumber: z.string().optional(),
    gstDocumentUrl: z.string().optional(),
    panDocumentUrl: z.string().optional(),
    fssaiDocumentUrl: z.string().optional(),
    bankProofDocumentUrl: z.string().optional(),
    manufacturingLicenseUrl: z.string().optional(),
    storageLicenseUrl: z.string().optional(),
    vendorProfileUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    onboardingStatus: z.nativeEnum(VendorOnboardingStatus).optional(),
    rejectionReason: z.string().min(1).optional(),
  }),
});

const vendorUpdateSchema = z.object({
  body: z.strictObject({
    businessName: z.string().min(2).optional(),
    natureOfBusiness: z.string().optional(),
    contactPersonName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    mobileNumber: z.string().min(10).optional(),
    alternateMobile: z.string().optional(),
    companyOwnerName: z.string().optional(),
    companyAddress: z.string().max(100).optional(),
    authorizedRepresentative: z.string().optional(),
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
    fssaiLicenseNumber: z.string().optional(),
    accountHolderName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankIfsc: z.string().optional(),
    bankName: z.string().optional(),
    manufacturingLicenseNumber: z.string().optional(),
    storageLicenseNumber: z.string().optional(),
    gstDocumentUrl: z.string().optional(),
    panDocumentUrl: z.string().optional(),
    fssaiDocumentUrl: z.string().optional(),
    bankProofDocumentUrl: z.string().optional(),
    manufacturingLicenseUrl: z.string().optional(),
    storageLicenseUrl: z.string().optional(),
    vendorProfileUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    onboardingStatus: z.nativeEnum(VendorOnboardingStatus).optional(),
    rejectionReason: z.string().min(1).optional(),
  }),
});

const vendorValidator = {
  vendorRegisterSchema,
  vendorUpdateSchema,
};

export default vendorValidator;
