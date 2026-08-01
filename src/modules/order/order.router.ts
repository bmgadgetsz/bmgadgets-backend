import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import orderController from "./order.controller";
import orderValidator from "./order.validator";

const orderRouter = Router();

orderRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["ORDER_MANAGEMENT"], "WRITE", { openForCustomers: true }),
    validateRequest(orderValidator.createOrderSchema),
    orderController.createOrder,
  )
  .get(
    handleAuth(),
    checkPermission(["ORDER_MANAGEMENT"], "READ", {
      openForCustomers: true,
      openForVendors: true,
    }),
    orderController.getPaginatedOrders,
  );
orderRouter.get(
  "/price-summary",
  handleAuth(),
  orderController.getOrderSummary,
);
orderRouter.post("/test-push-order", orderController.testPushOrder);

orderRouter.post(
  "/verify-payment",
  // webhook, no auth or permission check
  orderController.verifyPayment,
);
orderRouter
  .route("/:id/reorder")
  .post(
    handleAuth(),
    checkPermission(["ORDER_MANAGEMENT"], "READ", { openForCustomers: true }),
    orderController.reorder,
  );
orderRouter.route("/:id/invoice").get(orderController.getInvoice);

orderRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["ORDER_MANAGEMENT"], "READ", { openForCustomers: true }),
    orderController.getOrderById,
  )
  .patch(
    handleAuth(),
    checkPermission(["ORDER_MANAGEMENT"], "WRITE"),
    validateRequest(orderValidator.updateOrderSchema),
    orderController.updateOrder,
  )
  .delete(
    handleAuth(),
    checkPermission(["ORDER_MANAGEMENT"], "DELETE"),
    orderController.deleteOrder,
  );

export default orderRouter;
