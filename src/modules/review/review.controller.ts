import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import prisma from "@/config/prisma";
import reviewService from "./review.service";

const createReview = catchAsync(async (req, res) => {
  const data = req.body;

  const customerProfileId = res.locals.currentUser.customerProfile?.id;

  if (!customerProfileId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Customer profile is not updated",
    );
  }

  const ordered = await prisma.order.findFirst({
    where: {
      createdById: customerProfileId,
      items: {
        some: {
          price: {
            OR: [
              { productVariant: { productId: data.productId } },
              { productCombo: { productId: data.productId } },
            ],
          },
        },
      },
    },
  });
  if (!ordered)
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You have not ordered this product",
    );

  const imageUrls: string[] =
    data.imageUrls || (data.imageUrl ? [data.imageUrl] : []);
  if (imageUrls.length > 2) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Maximum 2 images allowed per review",
    );
  }

  const response = await reviewService.createReview({
    ...data,
    imageUrl: imageUrls[0] || data.imageUrl || null,
    imageUrls,
    createdById: customerProfileId,
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Review created successfully",
    data: response,
  });
});

const getReviewById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await reviewService.getReviewById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Review fetched successfully",
    data: response,
  });
});

const getPaginatedReviews = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "isAdmin", "active", "productId"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await reviewService.getPaginatedReviews(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Reviews fetched successfully",
    data: response,
  });
});

const updateReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await reviewService.updateReview(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Review updated successfully",
    data: response,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await reviewService.deleteReview(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Review cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Review deleted successfully",
    data: response,
  });
});

const reviewController = {
  createReview,
  getReviewById,
  getPaginatedReviews,
  updateReview,
  deleteReview,
};
export default reviewController;
