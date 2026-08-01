import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import couponService from "./coupon.service";

const createCoupon = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await couponService.createCoupon(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Coupon code is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Coupon created successfully",
    data: response,
  });
});

const getCouponById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await couponService.getCouponById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Coupon fetched successfully",
    data: response,
  });
});

const getPaginatedCoupons = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await couponService.getPaginatedCoupons(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Coupons fetched successfully",
    data: response,
  });
});

const updateCoupon = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  let response;

  try {
    response = await couponService.updateCoupon(id, data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Coupon code is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Coupon updated successfully",
    data: response,
  });
});

const deleteCoupon = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await couponService.deleteCoupon(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Coupon cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Coupon deleted successfully",
    data: response,
  });
});

const couponController = {
  createCoupon,
  getCouponById,
  getPaginatedCoupons,
  updateCoupon,
  deleteCoupon,
};
export default couponController;
