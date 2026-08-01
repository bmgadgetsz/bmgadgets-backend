import handleAuth from "@/middleware/handleAuth";
import { Router } from "express";
import validateRequest from "@/middleware/validateRequest";
import warehouseComboStockController from "./warehouseComboStock.controller";
import warehouseComboStockValidator from "./warehouseComboStock.validator";

const warehouseComboStockRouter = Router();

warehouseComboStockRouter
  .route("/")
  .get(warehouseComboStockController.getPaginatedWarehouseComboStocks)
  .post(
    handleAuth(),
    validateRequest(
      warehouseComboStockValidator.createWarehouseComboStockSchema,
    ),
    warehouseComboStockController.createStock,
  );
warehouseComboStockRouter
  .route("/:id")
  .patch(
    handleAuth(),
    validateRequest(
      warehouseComboStockValidator.updateWarehouseComboStockSchema,
    ),
    warehouseComboStockController.updateStock,
  )
  .delete(handleAuth(), warehouseComboStockController.deleteStock);

export default warehouseComboStockRouter;
