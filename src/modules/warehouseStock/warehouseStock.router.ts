import handleAuth from "@/middleware/handleAuth";
import { Router } from "express";
import validateRequest from "@/middleware/validateRequest";
import warehouseStockController from "./warehouseStock.controller";
import warehouseStockValidator from "./warehouseStock.validator";

const warehouseStockRouter = Router();

warehouseStockRouter
  .route("/")
  .get(warehouseStockController.getPaginatedWarehouseVariantStock)
  .post(
    handleAuth(),
    validateRequest(warehouseStockValidator.createWarehouseStockSchema),
    warehouseStockController.createStock,
  );

warehouseStockRouter
  .route("/:id")
  .patch(
    handleAuth(),
    validateRequest(warehouseStockValidator.updateWarehouseStockSchema),
    warehouseStockController.updateStock,
  )
  .delete(handleAuth(), warehouseStockController.deleteStock);

export default warehouseStockRouter;
