import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import { createPayout } from "@/services/razorpay.service";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { VendorPayoutStatus } from "@/generated/prisma";
import transporter from "@/services/transporter.service";
import env from "@/config/env";
import prisma from "@/config/prisma";
import vendorPayoutService from "./vendorPayout.service";

const createVendorPayout = catchAsync(async (req, res) => {
  const data = req.body;

  const response = await vendorPayoutService.createVendorPayout(data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Vendor payout created successfully",
    data: response,
  });
});

const getVendorPayoutById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await vendorPayoutService.getVendorPayoutById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor payout fetched successfully",
    data: response,
  });
});

const getPaginatedVendorPayout = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "status",
    "vendorProfileId",
    "from",
    "to",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await vendorPayoutService.getPaginatedVendorPayouts(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor payout's fetched successfully",
    data: response,
  });
});

const updateVendorPayout = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const response = await vendorPayoutService.updateVendorPayout(id, data);

  // // Step 2: If finalise is true, trigger RazorpayX payout
  // if (response?.finalized) {
  //   try {
  //     // Calculate total amount from all items
  //     // Step 2: Calculate grossSale, totalCommission, netPayment
  //     const grossSale = response!.items.reduce((sum, item) => {
  //       const basePrice = item.orderItem.price.price * item.orderItem.quantity;
  //       return sum + basePrice;
  //     }, 0);

  //     const totalCommission = response!.items.reduce((sum, item) => {
  //       const basePrice = item.orderItem.price.price * item.orderItem.quantity;
  //       return sum + basePrice * (item.commission / 100);
  //     }, 0);

  //     // GST on the commission
  //     const gst = totalCommission * 0.18;

  //     // Net commission including GST
  //     const totalCommissionWithGST = totalCommission + gst;

  //     const netPayment = grossSale - totalCommissionWithGST;

  //     // Call your payout service
  //     const payout = await createPayout(
  //       response!.vendorProfile.razorpayFundAccountId!,
  //       netPayment,
  //       {
  //         vendorId: response!.vendorProfileId,
  //         vendorPayoutId: response!.id, // use batch ID as reference
  //       },
  //     );

  //     // Save RazorpayX payout info and mark status
  //     await vendorPayoutService.updateVendorPayout(response!.id, {
  //       razorpayPayoutId: payout.id,
  //       razorpayReferenceId: payout.reference_id,
  //       status: payout.status.toUpperCase(), // PENDING / INITIATED etc.
  //     });
  //   } catch (err) {
  //     console.error("Failed to create RazorpayX payout:", err);
  //     // Optionally mark status as FAILED in DB
  //     await vendorPayoutService.updateVendorPayout(response!.id, {
  //       status: "FAILED",
  //     });
  //   }
  // }

  res.status(httpStatus.OK).json({
    success: true,
    message:
      "Vendor payout updated successfully. You can check payment status through dashboard",
    data: response,
  });
});

const deleteVendorPayout = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await vendorPayoutService.deleteVendorPayout(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Vendor payout cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor payout deleted successfully",
    data: response,
  });
});

const razorpayPayout = catchAsync(async (req, res) => {
  const { id: vendorPayoutId } = req.params;
  const { forceRetry, mode } = req.body;
  if (mode && mode !== "IMPS" && mode !== "NEFT" && mode && "RTGS") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "incorrect mode selected value can only be either NEFT, IMPS, or RTGS",
    );
  }

  const payoutRecord =
    await vendorPayoutService.getVendorPayoutById(vendorPayoutId);

  if (!payoutRecord?.finalized) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Not finalized yet");
  }

  if (
    payoutRecord.razorpayPayoutId &&
    payoutRecord.status !== "FAILED" &&
    !forceRetry
  ) {
    throw new ApiError(httpStatus.CONFLICT, "Payout already exists");
  }

  // 🚦 Validate commission setup
  const hasInvalidCommission = payoutRecord!.items!.some(
    (item) => !item.commission || item.commission <= 0,
  );
  if (hasInvalidCommission) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Payout not ready: one or more items have missing/zero commission",
    );
  }

  // ✅ Calculate net payment
  const grossSale = payoutRecord!.items!.reduce((sum, item) => {
    // const itemType = item.orderItem.price.productVariant
    //   ? "productVariant"
    //   : "productCombo";
    const basePrice = item.orderItem.price.price;
    const discountPercentage =
      item.orderItem.price.productVariant?.discountPercentage ?? 0;
    const finalPrice = basePrice - basePrice * (discountPercentage / 100);

    return sum + finalPrice * item.orderItem.quantity;
  }, 0);

  const totalCommission = payoutRecord!.items!.reduce(
    (sum, item) =>
      sum +
      item.orderItem.price.price *
        item.orderItem.quantity *
        (item.commission / 100),
    0,
  );

  const gst = totalCommission * 0.18;
  const netPayment =
    grossSale - (totalCommission + gst + (payoutRecord!.marketFee ?? 0));

  if (netPayment <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid net payment");
  }

  // 🔑 Decide idempotency key
  let idempotencyKey: string;
  if (forceRetry) {
    // Generate a brand new key for new payout attempt
    const retryCount = (payoutRecord.retryCount || 0) + 1;
    idempotencyKey = `${vendorPayoutId}_retry${retryCount}`;
    await vendorPayoutService.updateVendorPayout(vendorPayoutId, {
      retryCount,
    });
  } else {
    // Reuse old key if exists (safe retry)
    idempotencyKey =
      payoutRecord.razorpayIdempotencyKey || `${vendorPayoutId}_init`;
  }

  console.log("PAYOUT PAGE"); // eslint-disable-line no-console
  try {
    // 🚀 Call Razorpay
    const payout = await createPayout(
      payoutRecord!.vendorProfile!.razorpayFundAccountId!,
      netPayment,
      { vendorId: payoutRecord.vendorProfileId!, vendorPayoutId },
      idempotencyKey,
      mode ?? undefined,
    );
    res.json({
      success: true,
      message: "Payment Successfully initiated",
      data: payout,
    });
  } catch (
    err: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    if (err.response) {
      console.error("Razorpay error status:", err.response.status); // eslint-disable-line no-console
      console.error("Razorpay error data:", err.response.data); // eslint-disable-line no-console
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        err?.response?.data?.error?.description,
      );
    } else {
      console.error("Axios error:", err.message); // eslint-disable-line no-console
      throw new ApiError(httpStatus.BAD_REQUEST, err.message);
    }
  }
});

// GET /vendor-payouts/latest?status=COMPLETED
const getLatestVendorPayout = catchAsync(async (req, res) => {
  const vendorProfileId = req.query.vendorProfileId as string;

  if (!vendorProfileId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Vendor Id is required");
  }

  const status = req.query.status as VendorPayoutStatus | undefined;
  const data = await vendorPayoutService.getLatestVendorPayoutBreakdown(
    vendorProfileId,
    status,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Latest vendor payout fetched successfully",
    data,
  });
});

export const getVendorPayoutSummaryCtrl = catchAsync(async (req, res) => {
  const vendorProfileId = req.query.vendorProfileId as string;

  if (!vendorProfileId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Vendor Id is required");
  }

  const status = (req.query.status as any) || undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;

  const data = await vendorPayoutService.getVendorPayoutSummary({
    vendorProfileId,
    status,
    from,
    to,
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor payout summary fetched successfully",
    data,
  });
});

const sendStatementEmail = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, "No file uploaded");
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: req.body.vendorId },
  });

  const emailBody = `
    <p>Dear ${vendor?.contactPersonName},</p>
    <p>We hope this message finds you well. Please find attached your latest vendor payout statement. This document provides a detailed breakdown of your recent transactions and payouts.</p>
    <p>If you have any questions or require further clarification, please do not hesitate to reach out to our support team.</p>
    <p>Thank you for your continued partnership.</p>
    <p>Best regards,</p>
    <p>BMGadgets</p>
  `;

  await transporter.sendMail({
    from: env.email.user,
    to: vendor?.email,
    subject: "Vendor Payout Statement",
    html: emailBody,
    attachments: [
      {
        filename: req.file.originalname,
        content: req.file.buffer,
        contentType: req.file.mimetype,
      },
    ],
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Statement email sent successfully",
  });
});

const getPayoutStats = catchAsync(async (req, res) => {
  const data = await vendorPayoutService.getPayoutStats(req.query);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Payout stats fetched successfully",
    data,
  });
});

const venderPayoutController = {
  createVendorPayout,
  getVendorPayoutById,
  getPaginatedVendorPayout,
  updateVendorPayout,
  deleteVendorPayout,
  razorpayPayout,
  getLatestVendorPayout,
  getVendorPayoutSummaryCtrl,
  sendStatementEmail,
  getPayoutStats,
};
export default venderPayoutController;
