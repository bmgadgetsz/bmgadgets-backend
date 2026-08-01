import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import hsnConfigValidator from "./hsnConfig.validator";
import hsnConfigController from "./hsnConfig.controller";

const hsnConfigRouter = Router();

hsnConfigRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["HSN_AND_GST"], "WRITE"),
    validateRequest(hsnConfigValidator.createHsnConfigSchema),
    hsnConfigController.createHsnConfig,
  )
  .get(
    handleAuth(),
    checkPermission(["HSN_AND_GST"], "READ", {
      openForVendors: true,
    }),
    hsnConfigController.getPaginatedHsnConfigs,
  );
hsnConfigRouter.post(
  "/many",
  validateRequest(hsnConfigValidator.creazteManyHsnConfigSchema),
  hsnConfigController.createManyHsnConfig,
);

hsnConfigRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["HSN_AND_GST"], "READ"),
    hsnConfigController.getHsmConfigById,
  )
  .patch(
    handleAuth(),
    checkPermission(["HSN_AND_GST"], "WRITE"),
    validateRequest(hsnConfigValidator.updateHsnConfigSchema),
    hsnConfigController.updateHsnConfig,
  )
  .delete(
    handleAuth(),
    checkPermission(["HSN_AND_GST"], "DELETE"),
    hsnConfigController.deleteHsnConfig,
  );

export default hsnConfigRouter;
