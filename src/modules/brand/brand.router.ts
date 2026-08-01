import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import brandController from "./brand.controller";
import brandValidator from "./brand.validator";

// brand router instance
const brandRouter = Router();
// create brand api and get paginated brands api
brandRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["BRAND_MANAGEMENT"], "WRITE"),
    validateRequest(brandValidator.createBrandSchema),
    brandController.createBrand,
  )
  .get(
    handleAuth(),
    checkPermission(["BRAND_MANAGEMENT"], "READ", {
      openForVendors: true,
    }),
    brandController.getPaginatedBrands,
  );
// edit brand api and delete brand api
brandRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["BRAND_MANAGEMENT"], "READ"),
    brandController.getBrandById,
  )
  .patch(
    handleAuth(),
    checkPermission(["BRAND_MANAGEMENT"], "WRITE"),
    validateRequest(brandValidator.updateBrandSchema),
    brandController.updateBrand,
  )
  .delete(
    handleAuth(),
    checkPermission(["BRAND_MANAGEMENT"], "DELETE"),
    brandController.deleteBrand,
  );

export default brandRouter;
