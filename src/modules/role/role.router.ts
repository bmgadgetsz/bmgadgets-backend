import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import roleValidator from "./role.validator";
import roleController from "./role.controller";

const roleRouter = Router();

roleRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["RBAC_MODULE"], "WRITE"),
    validateRequest(roleValidator.createRoleSchema),
    roleController.createRole,
  )
  .get(
    handleAuth(),
    checkPermission(["RBAC_MODULE"], "READ"),
    roleController.getPaginatedRoles,
  );
roleRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["RBAC_MODULE"], "READ"),
    roleController.getRoleById,
  )
  .patch(
    handleAuth(),
    checkPermission(["RBAC_MODULE"], "WRITE"),
    validateRequest(roleValidator.updateRoleSchema),
    roleController.updateRole,
  )
  .delete(
    handleAuth(),
    checkPermission(["RBAC_MODULE"], "DELETE"),
    roleController.deleteRole,
  );

export default roleRouter;
