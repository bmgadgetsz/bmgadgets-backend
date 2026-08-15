import { Router } from "express"; // Import Router from express

// Import all route modules
import authRouter from "@/modules/auth/auth.router";
import brandRouter from "@/modules/brand/brand.router";
import categoryRouter from "@/modules/category/category.router";
import cmsRouter from "@/modules/cms/cms.router";
import commonRouter from "@/modules/common/common.router";
import upload from "@/config/multer";
import handleAuth from "@/middleware/handleAuth";
import validateRequest from "@/middleware/validateRequest";
import commonValidator from "@/modules/common/common.validator";
import commonController from "@/modules/common/common.controller";
import couponRouter from "@/modules/coupon/coupon.router";
import hsnConfigRouter from "@/modules/hsnConfig/hsnConfig.router";
import orderRouter from "@/modules/order/order.router";
import employeeRouter from "@/modules/employee/employee.router";
import productRouter from "@/modules/product/product.router";
import productComboRouter from "@/modules/productCombo/productCombo.router";
import reviewerRouter from "@/modules/review/review.router";
import roleRouter from "@/modules/role/role.router";
import subCategoryRouter from "@/modules/subcategory/subcategory.router";
import userRouter from "@/modules/user/user.router";
import variantRouter from "@/modules/variant/variant.router";
import vendorRouter from "@/modules/vendor/vendor.router";
import vendorPayoutRouter from "@/modules/vendorPayouts/vendorPayout.router";
import warehouseRouter from "@/modules/warehouse/warehouse.router";
import warehouseStockRouter from "@/modules/warehouseStock/warehouseStock.router";
import webhookRouter from "@/modules/webhook/webhook.route";

import returnRequestRouter from "@/modules/returnRequest/returnRequest.router";
import warehouseComboStockRouter from "@/modules/warehouseComboStock/warehouseComboStock.router";
import shipwayRouter from "@/modules/shipway/shipway.router";
import shipmentRouter from "@/modules/shipment/shipment.router";
import companyInfoRouter from "@/modules/compnayInfo/companyInfo.router";
import notificationRouter from "@/modules/notification/notification.route";
import ticketRouter from "@/modules/ticket/ticket.router";
import postRouter from "@/modules/post/post.router";

// Initialize the main router for version 1
const v1Router = Router();

// Define all routes with their respective paths and routers
const routes = [
  { path: "/cms", router: cmsRouter },
  { path: "/common", router: commonRouter },
  { path: "/company-info", router: companyInfoRouter },
  { path: "/notifications", router: notificationRouter },
  { path: "/tickets", router: ticketRouter },
  { path: "/posts", router: postRouter },

  { path: "/categories", router: categoryRouter },
  { path: "/sub-categories", router: subCategoryRouter },
  { path: "/variants", router: variantRouter },
  { path: "/products", router: productRouter },
  { path: "/product-combos", router: productComboRouter },
  { path: "/brands", router: brandRouter },
  { path: "/hsn-config", router: hsnConfigRouter },

  { path: "/auth", router: authRouter },
  { path: "/rbac", router: roleRouter },
  { path: "/users", router: userRouter },
  { path: "/employees", router: employeeRouter },
  { path: "/orders", router: orderRouter },
  { path: "/coupons", router: couponRouter },
  { path: "/reviews", router: reviewerRouter },
  { path: "/review", router: reviewerRouter },

  { path: "/vendors", router: vendorRouter },
  { path: "/vendor-payouts", router: vendorPayoutRouter },

  { path: "/webhooks", router: webhookRouter },

  { path: "/warehouses", router: warehouseRouter },
  { path: "/warehouse-stocks", router: warehouseStockRouter },
  { path: "/warehouse-combo-stocks", router: warehouseComboStockRouter },

  { path: "/return-requests", router: returnRequestRouter },
  { path: "/shipway", router: shipwayRouter },
  { path: "/shipments", router: shipmentRouter },
];

// Register each route with the main router
routes.forEach((route) => v1Router.use(route.path, route.router));

// Direct /file-upload endpoint mapping to support direct frontend uploads
v1Router.post(
  "/file-upload",
  handleAuth(),
  upload.array("file"),
  validateRequest(commonValidator.fileUpload),
  commonController.uploadSingleFile,
);

export default v1Router; // Export the main router

v1Router.post("/file-upload-public", upload.array("file"), commonController.uploadSingleFile);
