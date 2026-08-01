import { Router } from "express";
import shipwayController from "./shipway.controller";

const shipwayRouter = Router();

shipwayRouter.get("/serviceability", shipwayController.getPincodeServiceable);
shipwayRouter.get("/rates", shipwayController.getShipwayCarrierRates);
shipwayRouter.post("/pickup", shipwayController.createPickupOnShipway);
shipwayRouter.post("/cancel-shipment", shipwayController.cancelReturnShipment);
shipwayRouter.get("/carriers", shipwayController.getCarriersHandler);

export default shipwayRouter;
