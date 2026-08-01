import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import variantValidator from "./variant.validator";
import variantController from "./variant.controller";

const variantRouter = Router();

variantRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(variantValidator.createVariantSchema),
    variantController.createVariant,
  )
  .get(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "READ", { openForVendors: true }),
    variantController.getPaginatedVariants,
  );
variantRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "READ"),
    variantController.getVariantById,
  )
  .patch(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(variantValidator.updateVariantSchema),
    variantController.updateVariant,
  )
  .delete(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "DELETE"),
    variantController.deleteVariant,
  );

export default variantRouter;
