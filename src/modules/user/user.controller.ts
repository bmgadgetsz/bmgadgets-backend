import catchAsync from "@/utils/catchAsync";
import { status as httpStatus } from "http-status";
import ApiError from "@/utils/ApiError";
import { checkOtp } from "@/utils/password";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import pick from "@/utils/pick";
import env from "@/config/env";
import crypto from "crypto";
import razorpayInstance from "@/config/razorpay";
import prisma from "@/config/prisma";
import { Permission } from "@/generated/prisma";
import { Period } from "@/utils/userStats";
import userService from "./user.service";

const createUser = catchAsync(async (req, res) => {
  const data = req.body;
  await userService.createUser(data);
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "User created successfully",
  });
});

const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const data = req.body;

  if (!res.locals.currentUser.role.isAdmin && res.locals.currentUser.id !== id)
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this user",
    );

  if (data.email || data.phone) {
    if (!data.otp)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "OTP is required for email or phone update",
      );

    await checkOtp({ id, active: true }, data.otp);
  }

  let response;
  try {
    response = await userService.updateUser(id, data);
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Email or phone number already taken",
      );
    else next(error);
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Customer profile updated successfully",
    data: {
      ...{
        ...response,
        gender: response?.customerProfile?.gender ?? "",
        age: response?.customerProfile?.age ?? 0,
      },
      customerProfileCompleted: true,
      hasPrimaryAddress: !!response?.customerProfile?.addresses[0],
    },
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (
    !res.locals.currentUser.role.isAdmin &&
    !res.locals.currentUser.role.permissions
      .find((p: Permission) => p.resource === "USER_MANAGEMENT")
      ?.access.includes("DELETE")
  )
    if (res.locals.currentUser.id !== id)
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You are not allowed to delete this user",
      );

  await userService.deleteUser(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "User deleted successfully",
  });
});

const addCartItem = catchAsync(async (req, res) => {
  const userId = res.locals.currentUser.id;
  const data = req.body;

  const response = await userService.addCartItem(userId, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cart item created successfully",
    data: response,
  });
});

const updateCartItem = catchAsync(async (req, res) => {
  const { targetId } = req.params;
  const { quantity } = req.body;

  const userId = res.locals.currentUser.id;

  const response = await userService.updateCartItemQuantity(
    userId,
    targetId,
    quantity,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cart item updated successfully",
    data: response,
  });
});

const removeCartItem = catchAsync(async (req, res) => {
  const { targetId } = req.params;
  const userId = res.locals.currentUser.id;

  const response = await userService.removeCartItem(userId, targetId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cart item removed successfully",
    data: response,
  });
});

const getCartItem = catchAsync(async (_req, res) => {
  const userId = res.locals.currentUser.id;

  const response = await userService.getCartItems(userId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cart item fetch successfully",
    data: response,
  });
});

// WishList
const addItemToWishList = catchAsync(async (req, res) => {
  const userId = res.locals.currentUser.id;
  const data = req.body;

  if (!data.productVariantId && !data.productComboId)
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product variant or combo ID is required",
    );

  const response = await userService.addItemToWishList(userId, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Item added to wishlist successfully",
    data: response,
  });
});

const removeItemFromWishList = catchAsync(async (req, res) => {
  const { targetId } = req.params;
  const userId = res.locals.currentUser.id;

  const response = await userService.removeItemFromWishList(userId, targetId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Item removed from wishlist successfully",
    data: response,
  });
});

const getWishlistItems = catchAsync(async (_req, res) => {
  const userId = res.locals.currentUser.id;

  const response = await userService.getWishListItems(userId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Wishlist items fetch successfully",
    data: response,
  });
});

const getPaginatedUsers = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "isAdmin", "active"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await userService.getPaginatedUsers(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Users fetched successfully",
    data: response,
  });
});

const getAddresses = catchAsync(async (_req, res) => {
  const customerProfileId = res.locals.currentUser?.customerProfile?.id;
  if (!customerProfileId)
    throw new ApiError(httpStatus.NOT_FOUND, "Profile not completed");

  let response: unknown = null;
  if (customerProfileId)
    response =
      await userService.getAddressByCustomerProfileId(customerProfileId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Addresses fetched successfully",
    data: response,
  });
});

const createAddress = catchAsync(async (req, res) => {
  const userId = res.locals.currentUser.id;
  const data = req.body;

  const response = await userService.createAddress({ ...data, userId });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Address added successfully",
    data: response,
  });
});

const updateAddress = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const customerProfileId = res.locals.currentUser.customerProfile.id;
  if (!customerProfileId)
    throw new ApiError(httpStatus.BAD_REQUEST, "Customer profile not found");

  const address = await userService.getAddressById(id);
  if (!address) throw new ApiError(httpStatus.NOT_FOUND, "Address not found");
  if (address.customerProfile.userId !== res.locals.currentUser.id)
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this address",
    );

  const response = await userService.updateAddress(id, customerProfileId, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Address updated successfully",
    data: response,
  });
});

const topupWallet = catchAsync(async (req, res) => {
  const userId = res.locals.currentUser.id;
  const { amount } = req.body;

  const response = await userService.topupWallet(userId, amount);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Wallet topup initiated successfully",
    data: response,
  });
});

const veirfyTopupPayment = catchAsync(async (req, res) => {
  const { order_id: orderId, payment_id: paymentId, signature } = req.body;
  const secret = env.razorpay.keySecret;
  const hmac = crypto.createHmac("sha256", secret);

  hmac.update(`${orderId}|${paymentId}`);
  const generatedSignature = hmac.digest("hex");
  if (signature !== generatedSignature)
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid signature");

  const payment = await razorpayInstance.payments.fetch(paymentId);
  if (payment.status !== "captured")
    throw new ApiError(httpStatus.BAD_REQUEST, "Payment not captured");

  const walletLog = await prisma.walletLogs.findFirst({
    where: { razorpayOrderId: orderId },
  });
  if (!walletLog)
    throw new ApiError(httpStatus.NOT_FOUND, "Wallet log not found");

  await prisma.$transaction(async (tx) => {
    await tx.walletLogs.update({
      where: { id: walletLog.id },
      data: { razorpayPaymentId: paymentId, status: true },
    });
    await tx.customerProfile.update({
      where: { id: walletLog.customerProfileId },
      data: { wallet: { increment: walletLog.amount } },
    });
  });

  res
    .status(httpStatus.OK)
    .json({ success: true, message: "Payment verified" });
});

const getPaginatedWalletLogs = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const customerProfileId = res.locals.currentUser?.customerProfile?.id;
  if (!customerProfileId)
    throw new ApiError(httpStatus.NOT_FOUND, "Profile not completed");
  filters.customerProfileId = customerProfileId;

  const response = await userService.getPaginatedWalletLogs(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Wallet logs fetched successfully",
    data: response,
  });
});

const getUserStats = catchAsync(async (req, res) => {
  const period = (req.query.period as Period) ?? "Weekly";

  // Validate period
  const allowed: Period[] = ["Daily", "Weekly", "Monthly", "Quarterly"];
  if (!allowed.includes(period)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid period. Allowed: Daily | Weekly | Monthly | Quarterly",
    );
  }

  const data = await userService.getUserStats(period);
  res.status(httpStatus.OK).json({ success: true, data });
});

const getRecentUsers = catchAsync(async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "4", 10);
  const safeLimit = Math.min(Math.max(limit, 1), 100); // clamp between 1 and 100

  const data = await userService.getRecentUsers(safeLimit);
  res.status(httpStatus.OK).json({ success: true, data });
});

const userController = {
  // User
  createUser,
  updateUser,
  deleteUser,

  // Cart
  addCartItem,
  removeCartItem,
  updateCartItem,
  getCartItem,

  // WishList
  addItemToWishList,
  removeItemFromWishList,
  getWishlistItems,

  // Admin
  getPaginatedUsers,

  // Address
  getAddresses,
  createAddress,
  updateAddress,

  // wallet
  topupWallet,
  veirfyTopupPayment,
  getPaginatedWalletLogs,
  getRecentUsers,
  getUserStats,
};

export default userController;
