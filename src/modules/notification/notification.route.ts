import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import notificationController from "./notification.controller";
import notificationValidator from "./notification.validator";

const notificationRouter = Router();

notificationRouter
  .route("/")
  .get(handleAuth(), notificationController.getPaginatedNotifications);
notificationRouter.route("/:id").patch(
  handleAuth(),
  validateRequest(notificationValidator.updateNotificationSchema), // Validate request body against update schema
  notificationController.updateNotification,
);

export default notificationRouter;
