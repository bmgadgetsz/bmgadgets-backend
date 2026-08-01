import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import variantService from "./variant.service";

const createVariant = catchAsync(async (req, res) => {
  const data = req.body;
  const response = await variantService.createVariant(data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Variant created successfully",
    data: response,
  });
});

const getVariantById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await variantService.getVariantById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Variant fetched successfully",
    data: response,
  });
});

const getPaginatedVariants = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "get_all",
    "subCategoryId",
    "active",
    "isAdmin",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);
  const response = await variantService.getPaginatedVariants(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Variants fetched successfully",
    data: response,
  });
});

const updateVariant = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await variantService.updateVariant(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Variant updated successfully",
    data: response,
  });
});

const deleteVariant = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await variantService.deleteVariant(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Variant cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Variant deleted successfully",
    data: response,
  });
});

const variantController = {
  createVariant,
  getVariantById,
  getPaginatedVariants,
  updateVariant,
  deleteVariant,
};
export default variantController;
