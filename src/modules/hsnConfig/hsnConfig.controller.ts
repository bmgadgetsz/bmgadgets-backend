import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import hsnConfigService from "./hsnConfig.service";

const createHsnConfig = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await hsnConfigService.createHsnConfig(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(httpStatus.BAD_REQUEST, "HSN code is already exists");
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "HSN config created successfully",
    data: response,
  });
});

const createManyHsnConfig = catchAsync(async (req, res) => {
  const data = req.body;
  const response = await hsnConfigService.createManyHsnConfig(data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "HSN configs created successfully",
    data: response,
  });
});

const getHsmConfigById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await hsnConfigService.getHsnConfigById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "HSN config fetched successfully",
    data: response,
  });
});

const getPaginatedHsnConfigs = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await hsnConfigService.getPaginatedHsnConfigs(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "HSN configs fetched successfully",
    data: response,
  });
});

const updateHsnConfig = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  let response;

  try {
    response = await hsnConfigService.updateHsnConfig(id, data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(httpStatus.BAD_REQUEST, "HSN code is already exists");
    }

    throw e;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "HSN config updated successfully",
    data: response,
  });
});

const deleteHsnConfig = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await hsnConfigService.deleteHsnConfig(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Category cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "HSN config deleted successfully",
    data: response,
  });
});

const hsnConfigController = {
  createHsnConfig,
  createManyHsnConfig,
  getHsmConfigById,
  getPaginatedHsnConfigs,
  updateHsnConfig,
  deleteHsnConfig,
};
export default hsnConfigController;
