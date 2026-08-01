import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import subCategoryValidator from "./subcategory.validator";
import subCategoryController from "./subcategory.controller";

const subCategoryRouter = Router();

subCategoryRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(subCategoryValidator.createSubCategorySchema),
    subCategoryController.createSubCategory,
  )
  .get(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "READ", { openForVendors: true }),
    subCategoryController.getPaginatedSubCategories,
  );

subCategoryRouter
  .route("/many")
  .post(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(subCategoryValidator.createManySubCategoriesSchema),
    subCategoryController.createManySubCategories,
  );

subCategoryRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "READ"),
    subCategoryController.getSubCategoryById,
  )
  .patch(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(subCategoryValidator.updateSubCategorySchema),
    subCategoryController.updateSubCategory,
  )
  .delete(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "DELETE"),
    subCategoryController.deleteSubCategory,
  );

export default subCategoryRouter;
