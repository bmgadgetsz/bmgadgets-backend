import catchAsync from "@/utils/catchAsync";
import { status as httpStatus } from "http-status";
import companyInfoService from "./companyInfo.service";

const getCompanyInfo = catchAsync(async (_req, res) => {
  const response = await companyInfoService.getCompnayInfo();

  res.status(httpStatus.OK).json({
    success: true,
    message: "Company info fetched successfully",
    data: response,
  });
});

const updateCompanyInfo = catchAsync(async (req, res) => {
  const response = await companyInfoService.updateCompanyInfo(req.body);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Company info updated successfully",
    data: response,
  });
});

const getCompanyVendorInfo = catchAsync(async (_req, res) => {
  const response = await companyInfoService.getCompanyVendorInfo();

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor company info fetched successfully",
    data: response,
  });
});

const updateCompanyVendorInfo = catchAsync(async (req, res) => {
  const response = await companyInfoService.updateCompanyVendorInfo(req.body);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor company info updated successfully",
    data: response,
  });
});

const companyInfoController = {
  getCompanyInfo,
  updateCompanyInfo,
  updateCompanyVendorInfo,
  getCompanyVendorInfo,
};
export default companyInfoController;
