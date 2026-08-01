import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import subCategoryService from "./subcategory.service";

const createSubCategory = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await subCategoryService.createSubCategory(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Sub category name is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "SubCategory created successfully",
    data: response,
  });
});

const createManySubCategories = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await subCategoryService.createManySubCategory(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Sub category name is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "SubCategory created successfully",
    data: response,
  });
});

const getSubCategoryById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await subCategoryService.getSubCategoryById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "SubCategory fetched successfully",
    data: response,
  });
});

const getPaginatedSubCategories = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "categoryId",
    "isAdmin",
    "active",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);
  const response = await subCategoryService.getPaginatedSubCategories(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "SubCategories fetched successfully",
    data: response,
  });
});

const updateSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await subCategoryService.updateSubCategory(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "SubCategory updated successfully",
    data: response,
  });
});

const deleteSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await subCategoryService.deleteSubCategory(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Sub category name is already exists",
        );
      }

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subcategory cannot be deleted as it is associated with other resources",
      );
    }
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "SubCategory deleted successfully",
    data: response,
  });
});

const subCategoryController = {
  createSubCategory,
  createManySubCategories,
  getSubCategoryById,
  getPaginatedSubCategories,
  updateSubCategory,
  deleteSubCategory,
};
export default subCategoryController;
