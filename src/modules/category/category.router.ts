import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import categoryValidator from "./category.validator";
import categoryController from "./category.controller";

// category router instance
const categoryRouter = Router();

// create category api and get all categories api
categoryRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(categoryValidator.createCategorySchema),
    categoryController.createCategory,
  )
  .get(
    // public route
    categoryController.getPaginatedCategories,
  );

// category bulk create api
categoryRouter
  .route("/many")
  .post(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(categoryValidator.createManyCategoriesSchema),
    categoryController.createManyCategory,
  );

// get single category api, update single category api and delete single category api
categoryRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "READ", {
      openForCustomers: true,
    }),
    categoryController.getCategoryById,
  )
  .patch(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
    validateRequest(categoryValidator.updateCategorySchema),
    categoryController.updateCategory,
  )
  .delete(
    handleAuth(),
    checkPermission(["CATEGORY_MANAGEMENT"], "DELETE"),
    categoryController.deleteCategory,
  );

categoryRouter.post(
  "/:id/products",
  handleAuth(),
  checkPermission(["CATEGORY_MANAGEMENT"], "WRITE"),
  categoryController.assignProductsToCategory,
);

export default categoryRouter;
