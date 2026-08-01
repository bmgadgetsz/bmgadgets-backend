import prisma from "@/config/prisma";
import { CompanyInfo } from "@/generated/prisma";

const getCompnayInfo = async () => {
  return prisma.companyInfo.findFirst();
};

const updateCompanyInfo = async (data: CompanyInfo) => {
  const existingInfo = await getCompnayInfo();

  return prisma.companyInfo.upsert({
    where: { id: existingInfo?.id ?? "" },
    create: data,
    update: data,
  });
};

const getCompanyVendorInfo = async () => {
  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: { isOriginO: true },
  });
  return {
    companyAddress: vendorProfile?.companyAddress || null,
    gstNumber: vendorProfile?.gstNumber || null,
    panNumber: vendorProfile?.panNumber || null,
  };
};

const updateCompanyVendorInfo = async (
  data: Partial<{
    companyAddress: string;
    gstNumber: string;
    panNumber: string;
  }>,
) => {
  return prisma.vendorProfile.updateMany({ where: { isOriginO: true }, data });
};

const companyInfoService = {
  getCompnayInfo,
  updateCompanyInfo,
  updateCompanyVendorInfo,
  getCompanyVendorInfo,
};
export default companyInfoService;
