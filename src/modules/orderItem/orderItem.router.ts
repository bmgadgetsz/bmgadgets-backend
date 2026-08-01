// DEPRECATED
import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import orderItemValidator from "./orderItem.validator";
import orderItemController from "./orderItem.controller";

const orderItemRouter = Router();

orderItemRouter
  .route("/")
  .get(handleAuth(), orderItemController.getPaginatedOrderItems);

orderItemRouter
  .route("/:id")
  .get(orderItemController.getOrderItemById)
  .patch(
    validateRequest(orderItemValidator.updateOrderItemSchema),
    orderItemController.updateOrderItem,
  );

export default orderItemRouter;
