import { Router } from "express";
import validateRequest from "@/middleware/validateRequest";
import companyInfoController from "./companyInfo.controller";
import companyInfoValidator from "./companyInfo.vaildator";

const companyInfoRouter = Router();

companyInfoRouter
  .route("/")
  .get(companyInfoController.getCompanyInfo)
  .patch(
    validateRequest(companyInfoValidator.updateCompanyInfoSchema),
    companyInfoController.updateCompanyInfo,
  );
companyInfoRouter
  .route("/vendor-info")
  .get(companyInfoController.getCompanyVendorInfo)
  .patch(
    validateRequest(companyInfoValidator.updateCompanyVendorInfoSchema),
    companyInfoController.updateCompanyVendorInfo,
  );

export default companyInfoRouter;
