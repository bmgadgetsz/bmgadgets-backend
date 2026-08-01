// DEPRECATED: From boilerplate
import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import postValidator from "./post.validator";
import postController from "./post.controller";

const postRouter = Router();

postRouter
  .route("/")
  .post(
    validateRequest(postValidator.createPostSchema),
    postController.createPost,
  )
  .get(postController.getPaginatedPosts);
postRouter
  .route("/:id")
  .get(postController.getPostById)
  .patch(
    validateRequest(postValidator.updatePostSchema),
    postController.updatePost,
  )
  .delete(postController.deletePost);

export default postRouter;
