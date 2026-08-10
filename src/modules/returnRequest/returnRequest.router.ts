import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import returnRequestController from "./returnRequest.controller";
import returnRequestValidator from "./returnRequest.validator";

const returnRequestRouter = Router();

returnRequestRouter.get("/stats", returnRequestController.getReturnStats);

returnRequestRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["REFUND_AND_RETURNS"], "WRITE", {
      openForCustomers: true,
    }),
    validateRequest(returnRequestValidator.createReturnRequestSchema),
    returnRequestController.createReturnRequest,
  )
  .get(
    handleAuth(),
    checkPermission(["REFUND_AND_RETURNS"], "READ", {
      openForCustomers: true,
      openForVendors: true,
    }),
    returnRequestController.getPaginatedReturnRequests,
  );
returnRequestRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["REFUND_AND_RETURNS"], "READ"),
    returnRequestController.getReturnRequestById,
  )
  .patch(
    handleAuth(),
    checkPermission(["REFUND_AND_RETURNS"], "WRITE"),
    validateRequest(returnRequestValidator.updateReturnRequestSchema),
    returnRequestController.updateReturnRequest,
  )
  .delete(
    handleAuth(),
    checkPermission(["REFUND_AND_RETURNS"], "DELETE"),
    returnRequestController.deleteReturnRequest,
  );
returnRequestRouter
  .route("/:id/approve")
  .patch(
    handleAuth(),
    checkPermission(["REFUND_AND_RETURNS"], "WRITE"),
    returnRequestController.approveReturnRequestHandler,
  );

export default returnRequestRouter;
