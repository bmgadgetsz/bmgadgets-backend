import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import employeeController from "./employee.controller";
import employeeValidator from "./employee.validator";

const employeeRouter = Router();

employeeRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "WRITE"),
    validateRequest(employeeValidator.createEmployeeSchema),
    employeeController.createEmployee,
  )
  .get(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "READ"),
    employeeController.getPaginatedEmployees,
  );
employeeRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "READ"),
    employeeController.getEmployeeById,
  )
  .patch(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "WRITE"),
    validateRequest(employeeValidator.updateEmployeeSchema),
    employeeController.updateEmployee,
  )
  .delete(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "DELETE"),
    employeeController.deleteEmployee,
  );

export default employeeRouter;
