import handleAuth from "@/middleware/handleAuth";
import { Router } from "express";
import validateRequest from "@/middleware/validateRequest";
import checkPermission from "@/middleware/checkPermission";
import warehouseController from "./warehouse.controller";
import warehouseValidator from "./warehouse.validator";

const warehouseRouter = Router();

warehouseRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["WAREHOUSE"], "WRITE"),
    validateRequest(warehouseValidator.createWarehouseSchema),
    warehouseController.createWarehouse,
  )
  .get(
    handleAuth(),
    checkPermission(["WAREHOUSE"], "READ", { openForVendors: true }),
    warehouseController.getPaginatedWarehouses,
  );

warehouseRouter
  .route("/:warehouseId")
  .get(
    handleAuth(),
    checkPermission(["WAREHOUSE"], "READ"),
    warehouseController.getWarehouseById,
  )
  .patch(
    handleAuth(),
    checkPermission(["WAREHOUSE"], "WRITE"),
    validateRequest(warehouseValidator.updateWarehouseSchema),
    warehouseController.updateWarehouse,
  )
  .delete(
    handleAuth(),
    checkPermission(["WAREHOUSE"], "DELETE"),
    warehouseController.deleteWarehouse,
  );

export default warehouseRouter;
