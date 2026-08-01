import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import postService from "./post.service";

const createPost = catchAsync(async (req, res) => {
  const data = req.body;
  const response = await postService.createPost(data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Post created successfully",
    data: response,
  });
});

const getPostById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await postService.getPostById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Post fetched successfully",
    data: response,
  });
});

const getPaginatedPosts = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "get_all", "role", "employee"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);
  const response = await postService.getPaginatedPosts(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Posts fetched successfully",
    data: response,
  });
});

const updatePost = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await postService.updatePost(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Post updated successfully",
    data: response,
  });
});

const deletePost = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await postService.deletePost(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Post deleted successfully",
    data: response,
  });
});

const postController = {
  createPost,
  getPostById,
  getPaginatedPosts,
  updatePost,
  deletePost,
};
export default postController;
