import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import categoryService from "./category.service";

/**
 * Handler for creating a category
 */
const createCategory = catchAsync(async (req, res) => {
  // category data
  const data = req.body;

  // declare response
  let response;

  try {
    // delegate to service layer to create category
    response = await categoryService.createCategory(data);
  } catch (e) {
    // unique category name constraint
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Category name is already exists",
      );
    }
    throw e;
  }

  // send response to client
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Category created successfully",
    data: response,
  });
});

/**
 * Handler for category bulk creation
 */
const createManyCategory = catchAsync(async (req, res) => {
  // categories data
  const data = req.body;

  // declare response
  let response;

  try {
    // delegate to servicelayer to bulk create categories
    response = await categoryService.createManyCategories(data);
  } catch (e) {
    // unique category name constraint
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Category name is already exists",
      );
    }
    throw e;
  }

  // send response to client
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Categories created successfully",
    data: response,
  });
});

/**
 * Handler to get single category
 */
const getCategoryById = catchAsync(async (req, res) => {
  // category id from path params
  const { id } = req.params;
  // delegate to service layer to get the category
  const response = await categoryService.getCategoryById(id);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Category fetched successfully",
    data: response,
  });
});

/**
 * Handler to get paginated categories
 */
const getPaginatedCategories = catchAsync(async (req, res) => {
  // only allow the following filters ignore others
  const filters = pick(req.query, ["search", "isAdmin", "active", "getAll"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to get the list of categories
  const response = await categoryService.getPaginatedCategories(
    filters,
    options,
  );

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Categories fetched successfully",
    data: response,
  });
});

/**
 * Handler to update a category by its id
 */
const updateCategory = catchAsync(async (req, res) => {
  // category id from path params
  const { id } = req.params;
  // category data to be updated
  const data = req.body;

  // declare response
  let response;

  try {
    // delegate to service layer to update the category
    response = await categoryService.updateCategory(id, data);
  } catch (e) {
    // unique category name constraint
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Category name is already exists",
      );
    }
    throw e;
  }

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Category updated successfully",
    data: response,
  });
});

/**
 * Handler to delete category by its id
 */
const deleteCategory = catchAsync(async (req, res) => {
  // category id from path params
  const { id } = req.params;

  // declare response
  let response;
  try {
    // delegate to service layer to delete category
    response = await categoryService.deleteCategory(id);
  } catch (error) {
    // prisma required relation integrity constraint
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Category cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Category deleted successfully",
    data: response,
  });
});

const categoryController = {
  createCategory,
  createManyCategory,
  getCategoryById,
  getPaginatedCategories,
  updateCategory,
  deleteCategory,
};
export default categoryController;
