import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import orderItemService from "./orderItem.service";

const createOrderItem = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await orderItemService.createOrderItem(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "OrderItem name is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "OrderItem created successfully",
    data: response,
  });
});

const getOrderItemById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await orderItemService.getOrderItemById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "OrderItem fetched successfully",
    data: response,
  });
});

const getPaginatedOrderItems = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "vendorProfileId",
    "cycleStart",
    "cycleEnd",
    "orderStatus",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);
  const { currentUser } = res.locals;

  if (currentUser.role.isVendor) {
    if (currentUser.vendorProfile?.id)
      filters.vendorProfileId = currentUser.vendorProfile.id;
    else
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Vendor profile not found for the current user",
      );
  }

  const response = await orderItemService.getPaginatedCategories(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Orderitems fetched successfully",
    data: response,
  });
});

const updateOrderItem = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  let response;

  try {
    response = await orderItemService.updateOrderItem(id, data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "OrderItem name is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "OrderItem updated successfully",
    data: response,
  });
});

const deleteOrderItem = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await orderItemService.deleteOrderItem(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "OrderItem cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "OrderItem deleted successfully",
    data: response,
  });
});

const orderItemController = {
  createOrderItem,
  getOrderItemById,
  getPaginatedOrderItems,
  updateOrderItem,
  deleteOrderItem,
};
export default orderItemController;
