import { VendorOnboardingStatus } from "@/generated/prisma";

/**
 * Interface representing the body of a vendor registration request.
 */
export interface VendorRegisterBody {
  businessName: string;
  natureOfBusiness: string;
  contactPersonName: string;
  email: string;
  mobileNumber: string;
  alternateMobile?: string;
  companyOwnerName?: string;
  companyAddress?: string;
  authorizedRepresentative?: string;
  gstNumber?: string;
  panNumber?: string;
  fssaiLicenseNumber?: string;
  accountHolderName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  manufacturingLicenseNumber?: string;
  storageLicenseNumber?: string;
  gstDocumentUrl?: string;
  panDocumentUrl?: string;
  fssaiDocumentUrl?: string;
  bankProofDocumentUrl?: string;
  manufacturingLicenseUrl?: string;
  storageLicenseUrl?: string;
  vendorProfileUrl?: string;
  isActive?: boolean;
  onboardingStatus?: VendorOnboardingStatus;
  rejectionReason?: string;
}
