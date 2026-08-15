import env from "@/config/env";
import prisma from "@/config/prisma";
import razorpayInstance from "@/config/razorpay";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ensureOrderFulfillableBySingleWarehouse from "@/services/shipway/eligibility";
import enqueuePushOrder from "@/services/shipway/queueWorker";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import crypto from "crypto";
import { status as httpStatus } from "http-status";
import { sendMail } from "@/services/transporter.service";
import { z } from "zod";
import { getIO } from "@/config/socket";
import sendSms from "@/utils/sendSms";
import message91Templates from "@/config/message91Templates";
import orderService from "./order.service";
import orderTemplate from "./order.template";

const createOrder = catchAsync(async (req, res) => {
  const currentUser = res.locals.currentUser;
  const { couponCode, paymentType, customer, address, items } = req.body;

  const response = await orderService.createOrder({
    currentUser,
    paymentType,
    couponCode,
    customer,
    address,
    items,
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Order created successfully",
    data: response,
  });
});

const getOrderById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await orderService.getOrderById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Order fetched successfully",
    data: response,
  });
});

const verifyPayment = catchAsync(async (req, res) => {
  // eslint-disable-next-line camelcase
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

  const oldOrder = await prisma.order.findFirst({
    where: { razorpayOrderId: orderId },
    include: { tempCoupon: true, createdBy: { include: { user: true } } },
  });
  if (!oldOrder)
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found for this ID");

  const updatedOrder = await prisma.$transaction(
    async (tx) => {
      // Decrement coupon usage limit if applicable
      if (oldOrder?.tempCoupon && oldOrder.tempCoupon.usageLimit !== null) {
        await tx.coupon.update({
          where: { id: oldOrder.tempCoupon.id },
          data: { usageLimit: { decrement: 1 } },
        });
      }

      // Update order status and payment details
      const txUpdatedOrder = await tx.order.update({
        where: { id: oldOrder?.id },
        data: {
          status: "PAID",
          razorpayPaymentId: paymentId,
          razorpayPaymentMethod: payment.method,
          razorpayPaymentTime: new Date(),
          couponId: oldOrder?.tempCouponId,
        },
      });
      // Update custoemr wallet
      await tx.customerProfile.update({
        where: { id: oldOrder?.createdById },
        data: {
          wallet: {
            decrement: oldOrder.createdBy.walletBufferForOnlinePayments,
          },
          walletBufferForOnlinePayments: oldOrder.createdBy
            .walletBufferForOnlinePayments
            ? 0
            : undefined,
        },
      });
      await tx.walletLogs.create({
        data: {
          customerProfileId: oldOrder?.createdById,
          amount: -oldOrder.createdBy.walletBufferForOnlinePayments,
          type: "DEBIT",
          orderId: oldOrder?.id,
        },
      });
      // Clear cart
      await tx.cartItem.deleteMany({
        where: { customerProfileId: oldOrder?.createdById },
      });

      return txUpdatedOrder;
    },
    { timeout: 30_000 },
  ); // 30 seconds

  // WARN: secondary query to fetch updated order
  const { data: safeEmail } = z
    .string()
    .email()
    .safeParse(oldOrder?.createdBy.user.email);
  const { cart, grandTotal } = await orderService.calculateCart(
    oldOrder.createdById,
    oldOrder.tempCoupon?.code,
  );
  if (safeEmail) {
    await sendMail(
      safeEmail,
      `Order Confirmation - #${oldOrder?.id}`,
      // @ts-expect-error essential types are there
      orderTemplate.generateOrderConfirmationEmail(oldOrder, cart, grandTotal),
    );
  }
  await sendSms(
    message91Templates.orderConfirmation,
    oldOrder.createdBy.user.phone,
    {
      Name: oldOrder.createdBy.user.name!,
      Order_ID: oldOrder.id,
      Amount: grandTotal.toString(),
    },
  );

  const employeesToBeNotified = await prisma.user.findMany({
    where: {
      OR: [
        { role: { isAdmin: true } },
        {
          role: {
            permissions: {
              some: {
                resource: "ORDER_MANAGEMENT",
                access: { hasSome: ["WRITE", "DELETE"] },
              },
            },
          },
        },
      ],
    },
  });
  await prisma.notification.createMany({
    data: employeesToBeNotified.map((e) => ({
      type: "ORDER_CONFIRMED",
      title: `Payment of ₹${payment.amount} received for order #${oldOrder.id}`,
      receiverId: e.id,
      orderId: oldOrder.id,
    })),
  });
  const io = getIO();
  employeesToBeNotified.forEach((vh) => {
    io.to(vh.id).emit("notification", {
      id: oldOrder.id,
    });
  });

  // --- AFTER TX COMMIT: run pre-check for fulfillability
  const eligibility = await ensureOrderFulfillableBySingleWarehouse(
    updatedOrder.id,
  );
  if (!eligibility.ok) {
    // eslint-disable-next-line no-console
    console.log(eligibility.message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Payment verified, but order cannot be fulfilled from a single warehouse",
    );
  }

  enqueuePushOrder(updatedOrder.id).catch(async (err) => {
    // eslint-disable-next-line
    console.error("enqueuePushOrder failed (async)", err);
    // await prisma.shipwayLog.create({
    //   data: { orderId: order.id, status: "FAILED", error: String(err) },
    // });
    // await prisma.order.update({
    //   where: { id: order.id },
    //   data: { status: "PAID_ENQUEUE_FAILED" },
    // });
  });

  res
    .status(httpStatus.OK)
    .json({ success: true, message: "Payment verified", data: updatedOrder });
});

const getPaginatedOrders = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "status",
    "withRefund",
    "createdById",
    "paymentType",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const { currentUser } = res.locals;
  if (currentUser?.role?.isCustomer && !currentUser?.role?.isAdmin) {
    if (!currentUser.customerProfile?.id) {
      res.status(httpStatus.OK).json({
        success: true,
        message: "Orders fetched successfully",
        data: { meta: { total: 0, page: 1, limit: 10 }, data: [] },
      });
      return;
    }

    filters.createdById = currentUser.customerProfile.id;
  }

  // Only restrict by vendorId if user is a vendor and NOT an admin
  if (currentUser?.role?.isVendor && !currentUser?.role?.isAdmin) {
    if (currentUser.vendorProfile?.id) {
      filters.vendorId = currentUser.vendorProfile.id;
    }
  }

  const response = await orderService.getPaginatedOrders(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Orders fetched successfully",
    data: response,
  });
});

const updateOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await orderService.updateOrder(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Order updated successfully",
    data: response,
  });
});

const deleteOrder = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await orderService.deleteOrder(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Order deleted successfully",
    data: response,
  });
});

const reorder = catchAsync(async (req, res) => {
  const { id: orderId } = req.params;
  const currentUserCusomerProfileId = res.locals.currentUser.customerProfile.id;
  const order = await orderService.getOrderById(orderId);

  if (order?.createdById !== currentUserCusomerProfileId)
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to reorder this order",
    );

  const response = await orderService.reorder(orderId);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Order created successfully",
    data: response,
  });
});

const getOrderSummary = catchAsync(async (req, res) => {
  const createdById = res.locals.currentUser.customerProfile.id;
  const { couponCode } = req.query;

  const response = await orderService.getOrderSummary(
    createdById,
    couponCode?.toString(),
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Order summary fetched successfully",
    data: response,
  });
});

const testPushOrder = catchAsync(async (req, res) => {
  const { orderId } = req.body;

  const eligibility = await ensureOrderFulfillableBySingleWarehouse(orderId);
  if (!eligibility.ok) {
    // eslint-disable-next-line no-console
    console.log(eligibility.message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Payment verified, but order cannot be fulfilled from a single warehouse",
    );
  }

  enqueuePushOrder(orderId).catch(async (err) => {
    // eslint-disable-next-line
    console.error("enqueuePushOrder failed (async)", err);
    // await prisma.shipwayLog.create({
    //   data: { orderId: order.id, status: "FAILED", error: String(err) },
    // });
    // await prisma.order.update({
    //   where: { id: order.id },
    //   data: { status: "PAID_ENQUEUE_FAILED" },
    // });
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "Order enqueued for pushing to Shipway",
  });
});

const getInvoice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const invoice = await orderService.getInvoice(id);

  res.status(httpStatus.OK).json(invoice);
});

const orderController = {
  createOrder,
  verifyPayment,
  getOrderById,
  getPaginatedOrders,
  updateOrder,
  deleteOrder,
  reorder,
  getOrderSummary,
  testPushOrder,
  getInvoice,
};
export default orderController;
