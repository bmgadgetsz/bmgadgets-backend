import handleAuth from "@/middleware/handleAuth";
import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import upload from "@/config/multer";
import checkPermission from "@/middleware/checkPermission";
import { vendorPayloadValidator } from "./vendorPayout.validator";
import venderPayoutController from "./vendorPayout.controller";

const vendorPayoutRouter = Router();

vendorPayoutRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["PAYOUT_MANAGEMENT"], "WRITE"),
    validateRequest(vendorPayloadValidator.createVendorPayoutSchema),
    venderPayoutController.createVendorPayout,
  )
  .get(
    handleAuth(),
    checkPermission(["PAYOUT_MANAGEMENT"], "READ", { openForVendors: true }),
    venderPayoutController.getPaginatedVendorPayout,
  );
vendorPayoutRouter.get(
  "/stats",
  handleAuth(),
  checkPermission(["PAYOUT_MANAGEMENT"], "READ", { openForVendors: true }),
  venderPayoutController.getPayoutStats,
);

vendorPayoutRouter.get(
  "/summary",
  handleAuth(),
  checkPermission(["PAYOUT_MANAGEMENT"], "READ", { openForVendors: true }),
  venderPayoutController.getVendorPayoutSummaryCtrl,
);

vendorPayoutRouter.get(
  "/latest",
  handleAuth(),
  checkPermission(["PAYOUT_MANAGEMENT"], "READ", { openForVendors: true }),
  venderPayoutController.getLatestVendorPayout,
);

vendorPayoutRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["PAYOUT_MANAGEMENT"], "READ", { openForVendors: true }),
    venderPayoutController.getVendorPayoutById,
  )
  .patch(
    handleAuth(),
    checkPermission(["PAYOUT_MANAGEMENT"], "WRITE"),
    validateRequest(vendorPayloadValidator.updateVendorPayoutSchema),
    venderPayoutController.updateVendorPayout,
  )
  .delete(
    handleAuth(),
    checkPermission(["PAYOUT_MANAGEMENT"], "DELETE"),
    venderPayoutController.deleteVendorPayout,
  );
vendorPayoutRouter.post(
  "/:id/payout",
  handleAuth(),
  venderPayoutController.razorpayPayout,
);

vendorPayoutRouter
  .route("/statement")
  .post(
    upload.single("file"),
    validateRequest(vendorPayloadValidator.sendStatementEmail),
    venderPayoutController.sendStatementEmail,
  );

export default vendorPayoutRouter;
