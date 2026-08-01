import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import brandService from "./brand.service";

/**
 * Handler to create a new brand
 */
const createBrand = catchAsync(async (req, res) => {
  // get the brand data
  const data = req.body;

  // declare response
  let response;

  try {
    // delegate to service layer to create brand
    response = await brandService.createBrand(data);
  } catch (e) {
    // unique brand name constraint error
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Brand is already exists");
    }
    throw e;
  }

  // send response to client
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Brand created successfully",
    data: response,
  });
});

/**
 * Handler to get a single brand by its id
 */
const getBrandById = catchAsync(async (req, res) => {
  // get brand id from path params
  const { id } = req.params;
  // delegate to service layer to get brand
  const response = await brandService.getBrandById(id);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Brand fetched successfully",
    data: response,
  });
});

/**
 * Handler to get paginated brands
 */
const getPaginatedBrands = catchAsync(async (req, res) => {
  // allow only the following query, params ignore others
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // delegate to service layer to get brands
  const response = await brandService.getPaginatedBrands(filters, options);

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Brands fetched successfully",
    data: response,
  });
});

/**
 * Handler to update an existing brand by its id
 */
const updateBrand = catchAsync(async (req, res) => {
  // get brand id from path params
  const { id } = req.params;
  // data that needs to be updated
  const data = req.body;

  // declare response
  let response;

  try {
    // delegate to service layer to update the brand
    response = await brandService.updateBrand(id, data);
  } catch (e) {
    // unique brand name constraint error
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Brand is already exists");
    }
    throw e;
  }

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Brand updated successfully",
    data: response,
  });
});

/**
 * Handler to delete a brand by its id
 */
const deleteBrand = catchAsync(async (req, res) => {
  // get brand id from path params
  const { id } = req.params;

  // declare response
  let response;
  try {
    // delegate to service layer to delete a brand
    response = await brandService.deleteBrand(id);
  } catch (error) {
    // prisma required relation integrity constraint
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Brand cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  // send response to client
  res.status(httpStatus.OK).json({
    success: true,
    message: "Brand deleted successfully",
    data: response,
  });
});

const brandController = {
  createBrand,
  getBrandById,
  getPaginatedBrands,
  updateBrand,
  deleteBrand,
};
export default brandController;
