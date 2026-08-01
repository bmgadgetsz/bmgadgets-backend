import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import checkPermission from "@/middleware/checkPermission";
import handleAuth from "@/middleware/handleAuth";
import couponValidator from "./coupon.validator";
import couponController from "./coupon.controller";

const couponRouter = Router();

couponRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["COUPON_MANAGEMENT"], "WRITE"),
    validateRequest(couponValidator.createCouponSchema),
    couponController.createCoupon,
  )
  .get(
    handleAuth(),
    checkPermission(["COUPON_MANAGEMENT"], "READ", { openForCustomers: true }),
    couponController.getPaginatedCoupons,
  );

couponRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["COUPON_MANAGEMENT"], "READ"),
    couponController.getCouponById,
  )
  .patch(
    handleAuth(),
    checkPermission(["COUPON_MANAGEMENT"], "WRITE"),
    validateRequest(couponValidator.updateCouponSchema),
    couponController.updateCoupon,
  )
  .delete(
    handleAuth(),
    checkPermission(["COUPON_MANAGEMENT"], "DELETE"),
    couponController.deleteCoupon,
  );

export default couponRouter;
