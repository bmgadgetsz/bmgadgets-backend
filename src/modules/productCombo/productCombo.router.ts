import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import productComboController from "./productCombo.controller";
import productComboValidator from "./productCombo.validator";

const productComboRouter = Router();

productComboRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["COMBO_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productComboValidator.createProductComboSchema),
    productComboController.createProductCombo,
  )
  .get(
    handleAuth(),
    checkPermission(["COMBO_MANAGEMENT"], "READ", { openForVendors: true }),
    productComboController.getPaginatedProductCombos,
  );
productComboRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["COMBO_MANAGEMENT"], "READ", { openForVendors: true }),
    productComboController.getProductComboById,
  )
  .patch(
    handleAuth(),
    checkPermission(["COMBO_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productComboValidator.updateProductComboSchema),
    productComboController.updateProductCombo,
  )
  .delete(
    handleAuth(),
    checkPermission(["COMBO_MANAGEMENT"], "DELETE", { openForVendors: true }),
    productComboController.deleteProductCombo,
  );

export default productComboRouter;
