import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import { productValidator } from "./product.validator";
import productController from "./product.controller";

const productRouter = Router();

productRouter.get("/stats", productController.getProductStatsHandler);
productRouter.get("/top-categories", productController.getTopCategoriesHandler);
productRouter.get("/top-products", productController.getTopProductsHandler);
productRouter.get("/low-stock", productController.getLowStockHandler);
productRouter.post(
  "/parse-link",
  handleAuth(),
  checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
  productController.parseProductLinkHandler,
);

productRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productValidator.createProductSchema),
    productController.createProduct,
  )
  .get(
    // public route
    productController.getPaginatedProducts,
  );

productRouter.get(
  "/search-suggestions",
  productController.getSearchSuggestions,
);

productRouter
  .route("/many")
  .post(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productValidator.createManyProducts),
    productController.createManyProducts,
  );

productRouter
  .route("/:id")
  .get(
    // public route
    productController.getProductById,
  )
  .patch(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productValidator.updateProductSchema),
    productController.updateProduct,
  )
  .delete(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "DELETE", { openForVendors: true }),
    productController.deleteProduct,
  );

productRouter
  .route("/:productId/variants")
  .post(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productValidator.createProductVariantSchema),
    productController.createProductVariant,
  );

productRouter
  .route("/:productId/variants/:variantId")
  .delete(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "DELETE", {
      openForVendors: true,
    }),
    productController.deleteProductVariant,
  )
  .patch(
    handleAuth(),
    checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
    validateRequest(productValidator.updateProductVariantSchema),
    productController.updateProductVariant,
  );

productRouter.patch(
  "/:productId/status",
  handleAuth(),
  checkPermission(["PRODUCT_MANAGEMENT"], "WRITE", { openForVendors: true }),
  productController.updateProductStatus,
);

export default productRouter;
