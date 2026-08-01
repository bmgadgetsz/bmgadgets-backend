import { Router } from "express";
import webhookController from "./webhook.controller";

const webhookRouter = Router();

webhookRouter.route("/razorpayx").post(webhookController.razorpayxPayoutEvents);

webhookRouter.route("/shipway").post(webhookController.shipway);

export default webhookRouter;
