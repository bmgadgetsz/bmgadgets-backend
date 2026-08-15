import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import reviewController from "./review.controller";
import reviewValidator from "./review.validator";

const reviewerRouter = Router();

reviewerRouter.post("/public", reviewController.createPublicReview);
reviewerRouter.get("/public", reviewController.getPaginatedReviews);

reviewerRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["REVIEW_MANAGEMENT"], "WRITE", {
      openForCustomers: true,
    }),
    validateRequest(reviewValidator.createReviewSchema),
    reviewController.createReview,
  )
  .get(
    handleAuth(),
    checkPermission(["REVIEW_MANAGEMENT"], "READ", {
      openForCustomers: true,
      openForVendors: true,
    }),
    reviewController.getPaginatedReviews,
  );

reviewerRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["REVIEW_MANAGEMENT"], "READ"),
    reviewController.getReviewById,
  )
  .patch(
    handleAuth(),
    checkPermission(["REVIEW_MANAGEMENT"], "WRITE"),
    validateRequest(reviewValidator.updateReviewSchema),
    reviewController.updateReview,
  )
  .delete(
    handleAuth(),
    checkPermission(["REVIEW_MANAGEMENT"], "DELETE"),
    reviewController.deleteReview,
  );

export default reviewerRouter;
