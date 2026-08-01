// src/modules/shipment/router.ts
import handleAuth from "@/middleware/handleAuth";
import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import shipmentController from "./shipment.controller";
import shipmentValidator from "./shipment.validator";

const shipmentRouter = Router();

shipmentRouter.route("/").get(
  // list/paginate
  // handleAuth(),
  //   validateRequest(shipmentValidator.getPaginatedShipmentsSchema),
  shipmentController.getPaginatedShipmentsHandler,
);

shipmentRouter.get("/stats", shipmentController?.getShipmentStats);

shipmentRouter
  .route("/:id")
  .get(
    // handleAuth(),
    shipmentController.getShipmentByIdHandler,
  )
  .patch(
    validateRequest(shipmentValidator.updateShipmentSchema),
    shipmentController.updateShipmentHandler,
  )
  .delete(
    // handleAuth(),
    shipmentController.deleteShipmentHandler,
  );

// extra useful endpoints
shipmentRouter.get(
  "/by-order/:orderId",
  // handleAuth(),
  shipmentController.getShipmentsByOrderIdHandler,
);

shipmentRouter.get(
  "/returns/list",
  // handleAuth(),
  //   validateRequest(shipmentValidator.getPaginatedShipmentsSchema),
  shipmentController.getReturnShipmentsHandler,
);

export default shipmentRouter;
