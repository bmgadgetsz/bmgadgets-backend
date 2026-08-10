import handleAuth from "@/middleware/handleAuth";
import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import checkPermission from "@/middleware/checkPermission";
import vendorController from "./vendor.controller";
import vendorValidator from "./vendor.validator";

const vendorRouter = Router();

// Admin route to create vendors
vendorRouter.post(
  "/admin/create",
  handleAuth(), // must be admin
  checkPermission(["VENDOR_MANAGEMENT"], "WRITE"),
  validateRequest(vendorValidator.vendorRegisterSchema),
  vendorController.createVendorAdminHandler,
);

// New routes for dashboard:
vendorRouter.get("/stats", vendorController.getVendorStatsHandler);
vendorRouter.get("/top", vendorController.getTopVendorsHandler);
vendorRouter.get(
  "/sales-by-category",
  vendorController.getSalesByCategoryHandler,
);
vendorRouter.get(
  "/:vendorId/performance",
  vendorController.getVendorPerformanceHandler,
);
vendorRouter.get("/:vendorId/stats", vendorController?.getSingleVendorStats);
// === REPORT ROUTES (new) ===
// GET /api/vendors/:vendorId/reports/sales-timeseries?days=30
vendorRouter.get(
  "/:vendorId/reports/sales-timeseries",
  vendorController.getSalesTimeSeries,
);

// GET /api/vendors/:vendorId/reports/revenue-by-category
vendorRouter.get(
  "/:vendorId/reports/revenue-by-category",
  vendorController.getRevenueByCategory,
);

// GET /api/vendors/:vendorId/reports/top-products?limit=10
vendorRouter.get(
  "/:vendorId/reports/top-products",
  vendorController.getTopProducts,
);

// GET /api/vendors/:vendorId/reports/orders-by-status
vendorRouter.get(
  "/:vendorId/reports/orders-by-status",
  vendorController.getOrdersByStatus,
);

// vendor onboarding from frontend
vendorRouter
  .route("/")
  .post(
    validateRequest(vendorValidator.vendorRegisterSchema),
    vendorController.createVendorHandler,
  )
  .get(
    // handleAuth(),
    vendorController.getPaginatedVendorsHandler,
  );

vendorRouter
  .route("/:vendorId/onboarding-status")
  .patch(
    handleAuth(),
    checkPermission(["ONBOARD_MANAGEMENT"], "WRITE"),
    vendorController?.updateVendorStatusHandler,
  );

vendorRouter
  .route("/:vendorId/razorpay-account")
  .patch(
    handleAuth(),
    checkPermission(["ONBOARD_MANAGEMENT"], "WRITE"),
    vendorController?.updateVendorRazorpayAccount,
  );

vendorRouter
  .route("/:vendorId")
  .patch(
    handleAuth(),
    validateRequest(vendorValidator.vendorUpdateSchema),
    vendorController.updateVendorHandler,
  )
  .delete(
    handleAuth(),
    checkPermission(["ONBOARD_MANAGEMENT", "VENDOR_MANAGEMENT"], "DELETE"),
    vendorController.deleteVendorHandler,
  );

vendorRouter
  .route("/me")
  .get(handleAuth(), vendorController.getMyVendorDetailsHandler);

export default vendorRouter;
