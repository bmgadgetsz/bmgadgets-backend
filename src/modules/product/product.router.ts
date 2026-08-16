import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import cacheControl, { noCache } from "@/middleware/cacheControl";
import { productValidator } from "./product.validator";
import productController from "./product.controller";

const productRouter = Router();

productRouter.get("/stats", cacheControl(60, 300), productController.getProductStatsHandler);
productRouter.get("/top-categories", cacheControl(300, 600), productController.getTopCategoriesHandler);
productRouter.get("/top-products", cacheControl(300, 600), productController.getTopProductsHandler);
productRouter.get("/low-stock", cacheControl(60, 300), productController.getLowStockHandler);
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
    cacheControl(0, 60),
    productController.getPaginatedProducts,
  );

productRouter.get(
  "/search-suggestions",
  cacheControl(300, 600),
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
    noCache,
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
