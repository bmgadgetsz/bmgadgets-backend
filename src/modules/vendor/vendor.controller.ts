import env from "@/config/env";
import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import {
  Prisma,
  Role,
  User,
  VendorOnboardingStatus,
  VendorProfile,
} from "@/generated/prisma";
import { createContact, createFundAccount } from "@/services/razorpay.service";
import { sendMail } from "@/services/transporter.service";
import { vendorApprovedTemplate } from "@/template/email/vendorOnboarding";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import sendEmail from "@/utils/mail";
import pick from "@/utils/pick";
import { Period } from "@/utils/vendorStats";
import { status as httpStatus } from "http-status";
import vendorService from "./vendor.service";

const createVendorAdminHandler = catchAsync(async (req, res, next) => {
  const data = req.body;
  const role = await prisma.role.findFirst({
    where: { isVendor: true },
  });
  data.roleId = role?.id;
  data.onboardingStatus = "KYC_APPROVED";
  try {
    const response = await vendorService.createVendor(data);
    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Vendor created successfully",
      data: response,
    });
  } catch (
    err: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    // Handle Prisma unique constraint error
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const message =
        "This email or phone number is already in use. Please use a different email or phone number";
      throw new ApiError(httpStatus?.BAD_REQUEST, message);
    } else next(err);
  }
});

// vendor onboarding
const createVendorHandler = catchAsync(async (req, res, next) => {
  const data = req.body;
  const role = await prisma.role.findFirst({
    where: { isVendor: true },
  });
  data.roleId = role?.id;
  data.onboardingStatus = "REGISTRATION_PENDING";
  try {
    const response = await vendorService.createVendor(data);
    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Vendor created successfully",
      data: response,
    });
  } catch (
    err: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    // Handle Prisma unique constraint error
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const message =
        "This email or phone number is already in use. Please use a different email or phone number";
      throw new ApiError(httpStatus?.BAD_REQUEST, message);
    } else next(err);
  }
});

const getPaginatedVendorsHandler = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "isAdmin",
    "active",
    "onboardingStatus",
    "notApproved",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await vendorService.getPaginatedVendors(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendors fetched successfully",
    data: response,
  });
});

const updateVendorHandler = catchAsync(async (req, res) => {
  const currentUser = res.locals.currentUser as User & { role: Role };
  const { vendorId } = req.params;
  let data = req.body;
  // let newEmail = false;

  // If not admin, strip restricted fields
  if (currentUser?.role?.name === "Vendor") {
    // Fetch existing vendor to check current status
    const existingVendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      select: { onboardingStatus: true, userId: true, email: true },
    });

    if (!existingVendor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
    }
    // if (
    //   data.email &&
    //   typeof data.email === "string" &&
    //   data.email !== existingVendor!.email
    // ) {
    //   newEmail = true;
    // }
    const restrictedFields = [
      "onboardingStatus",
      "isActive",
      "rejectionReason",
      "approvedAt",
    ];
    data = Object.fromEntries(
      Object.entries(data).filter(([key]) => !restrictedFields.includes(key)),
    );
    // If status is REGISTRATION_APPROVED, move to KYC_PENDING automatically
    if (
      existingVendor.onboardingStatus === "REGISTRATION_APPROVED" ||
      existingVendor?.onboardingStatus === "KYC_REJECTED"
    ) {
      data.onboardingStatus = "KYC_PENDING";
    }
  }

  const response = await vendorService.updateVendor(vendorId, data);

  if (response.onboardingStatus === "KYC_PENDING") {
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
        type: "VENDOR_KYC_SUBMITTED",
        title: `Vendor ${response.businessName} submitted KYC for review.`,
        receiverId: e.id,
        vendorProfileId: response.id,
      })),
    });
    await prisma.notification.create({
      data: {
        type: "VENDOR_KYC_SUBMITTED",
        title: "Your KYC is under review.",
        receiverId: response.userId!,
        vendorProfileId: response.id,
      },
    });
    const io = getIO();
    employeesToBeNotified.forEach((vh) => {
      io.to(vh.id).emit("notification", {
        id: response.id,
      });
    });
    io.to(response.userId!).emit("notification", {
      id: response.id,
    });
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor updated successfully",
    data: response,
  });
});

const deleteVendorHandler = catchAsync(async (req, res) => {
  const { vendorId } = req.params;

  // soft-archive instead of hard delete
  const response = await vendorService.archiveVendor(vendorId, {
    redact: true,
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor archived successfully",
    data: response,
  });
});

const updateVendorStatusHandler = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  const { onboardingStatus, rejectionReason } = req.body;

  const updated = await vendorService.updateVendorStatus(
    vendorId,
    onboardingStatus as VendorOnboardingStatus,
    rejectionReason,
  );

  const razorpayError = false;
  const razorpayErrorMessage = "";
  // If vendor status is approved, create RazorpayX contact + fund account
  // if (updated.onboardingStatus === VendorOnboardingStatus.KYC_APPROVED) {
  //   try {
  //     // Step 1: Create Contact in RazorpayX
  //     let contact;
  //     if (!updated?.razorpayContactId) {
  //       contact = await createContact(
  //         updated,
  //         updated.accountHolderName!,
  //         "vendor", // or "employee", "customer" depending on use case
  //       );
  //     }

  //     // Step 2: Create Fund Account
  //     let fundAccount;
  //     if (!updated?.razorpayFundAccountId) {
  //       fundAccount = await createFundAccount(
  //         contact.id || updated?.razorpayContactId,
  //         updated.accountHolderName!,
  //         updated.bankIfsc!,
  //         updated.bankAccountNumber!,
  //       );
  //     }

  //     // Save contactId & fundAccountId in your DB for payouts later
  //     if (!updated?.razorpayContactId || !updated?.razorpayFundAccountId) {
  //       updated = await vendorService.updateVendor(vendorId, {
  //         ...(!updated?.razorpayContactId
  //           ? { razorpayContactId: contact.id }
  //           : {}),
  //         ...(!updated?.razorpayFundAccountId
  //           ? { razorpayFundAccountId: fundAccount.id }
  //           : {}),
  //         razorpayStatus: "COMPLETED",
  //       });
  //     }
  //   } catch (
  //     err: any // eslint-disable-line @typescript-eslint/no-explicit-any
  //   ) {
  //     if (err.response?.data?.error?.description) {
  //       console.error("RazorpayX error:", err.response.data.error.description); // eslint-disable-line no-console
  //       razorpayErrorMessage = err.response.data.error.description;
  //     } else {
  //       console.error("Unknown error:", err); // eslint-disable-line no-console
  //     }
  //     razorpayError = true;
  //     // Change razorpay status to failed
  //     updated = await vendorService.updateVendor(vendorId, {
  //       razorpayStatus: "FAILED",
  //     });
  //   }
  // }
  // Send email for status is changed
  if (onboardingStatus === VendorOnboardingStatus.REGISTRATION_APPROVED) {
    try {
      const template = vendorApprovedTemplate(
        updated.contactPersonName || "Vendor",
      );
      await sendEmail(updated.email, template.subject, template.html);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("Failed to send registration approved L1 email : ", err);
    }
  }

  if (onboardingStatus === VendorOnboardingStatus.REGISTRATION_REJECTED) {
    // try {
    //   const { subject, html } = registrationRejectedTemplate(
    //     updated.contactPersonName || "Vendor",
    //     rejectionReason,
    //   );
    //   await sendEmail(updated.email, subject, html);
    // } catch (err) {
    //   // eslint-disable-next-line no-console
    //   console.error("Failed to send registration rejection email:", err);
    // }
  }

  if (onboardingStatus === VendorOnboardingStatus.KYC_APPROVED) {
    try {
      // const { subject, html } = kycApprovedTemplate(
      //   updated.contactPersonName || "Vendor",
      // );
      // await sendEmail(updated.email, subject, html);
      await prisma.notification.create({
        data: {
          type: "VENDOR_KYC_APPROVED",
          title: "KYC approved – dashboard access enabled.",
          receiverId: updated.userId,
          vendorProfileId: updated.id,
        },
      });
      const io = getIO();
      io.to(updated.userId!).emit("notification", {
        id: updated.id,
      });
      await sendMail(
        updated.email,
        "KYC Approved – Dashboard Access Enabled",
        `Hi ${updated.contactPersonName},<br>Your KYC verification has been approved. 🎉<br><a href="${env.app.vendorPanelBaseUrl}">👉 Go to Dashboard</a><br>- Compliance Team`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to send KYC approval email:", err);
    }
  }

  if (onboardingStatus === VendorOnboardingStatus.KYC_REJECTED) {
    try {
      // const { subject, html } = kycRejectedTemplate(
      //   updated.contactPersonName || "Vendor",
      //   rejectionReason,
      // );
      // await sendEmail(updated.email, subject, html);

      await prisma.notification.create({
        data: {
          type: "VENDOR_KYC_REJECTED",
          title: `KYC rejected: ${rejectionReason}.`,
          receiverId: updated.userId,
          vendorProfileId: updated.id,
        },
      });
      const io = getIO();
      io.to(updated.userId!).emit("notification", {
        id: updated.id,
      });
      await sendMail(
        updated.email,
        "KYC Rejected – Action Required",
        `Hi ${updated.contactPersonName},<br>Your KYC request was rejected due to: ${rejectionReason}.<br>Please resubmit here: <a href="${env.app.vendorPanelBaseUrl}/application">Resubmit KYC</a> - Compliance Team`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to send KYC rejection email:", err);
    }
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor status updated successfully!",
    data: updated,
    razoryPayError: razorpayError,
    razorpayErrorMessage,
  });
});

const getMyVendorDetailsHandler = catchAsync(async (req, res) => {
  const currentUser = res.locals.currentUser as User & {
    vendorProfile?: VendorProfile;
  };
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor fetched successfully",
    data: currentUser?.vendorProfile,
  });
});

const updateVendorRazorpayAccount = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  let vendor = await prisma.vendorProfile.findUnique({
    where: {
      id: vendorId,
    },
  });
  if (!vendor) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Vendor not found");
  }
  let razorpayError = false;
  let razorpayErrorMessage = "";
  try {
    // Step 1: Create Contact in RazorpayX
    let contact;
    if (!vendor?.razorpayContactId) {
      contact = await createContact(
        vendor,
        vendor.accountHolderName!,
        "vendor", // or "employee", "customer" depending on use case
      );
    }

    // Step 2: Create Fund Account
    let fundAccount;
    if (!vendor?.razorpayFundAccountId) {
      fundAccount = await createFundAccount(
        contact.id || vendor?.razorpayContactId,
        vendor.accountHolderName!,
        vendor.bankIfsc!,
        vendor.bankAccountNumber!,
      );
    }

    // Save contactId & fundAccountId in your DB for payouts later
    if (!vendor?.razorpayContactId || !vendor?.razorpayFundAccountId) {
      vendor = await vendorService.updateVendor(vendorId, {
        ...(!vendor?.razorpayContactId
          ? { razorpayContactId: contact.id }
          : {}),
        ...(!vendor?.razorpayFundAccountId
          ? { razorpayFundAccountId: fundAccount.id }
          : {}),
        razorpayStatus: "COMPLETED",
      });
    }
  } catch (
    err: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    if (err.response?.data?.error?.description) {
      console.error("RazorpayX error:", err.response.data.error.description); // eslint-disable-line no-console
      razorpayErrorMessage = err.response.data.error.description;
    } else {
      console.error("Unknown error:", err); // eslint-disable-line no-console
    }
    razorpayError = true;
    // Change razorpay status to failed
    vendor = await vendorService.updateVendor(vendorId, {
      razorpayStatus: "FAILED",
    });
  }
  res.status(httpStatus.OK).json({
    data: vendor,
    razoryPayError: razorpayError,
    razorpayErrorMessage,
  });
});

const getVendorStatsHandler = catchAsync(async (req, res) => {
  const period = (req.query.period as string) || "Weekly";
  const data = await vendorService.getVendorStatsWithChange(period as any);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor stats fetched successfully",
    data,
  });
});

const getTopVendorsHandler = catchAsync(async (req, res) => {
  const period = (req.query.period as string) ?? "Weekly";
  const limit = Number(req.query.limit ?? 5);
  const data = await vendorService.getTopVendors(limit, period as any);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Top vendors fetched successfully",
    data,
  });
});

const getSalesByCategoryHandler = catchAsync(async (req, res) => {
  const period = (req.query.period as string) ?? "Weekly";
  const limit = Number(req.query.limit ?? 5);
  const data = await vendorService.getSalesByCategory(limit, period as any);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Sales by category fetched successfully",
    data,
  });
});

const getVendorPerformanceHandler = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId is required");

  const period = (req.query.period as string) ?? "Weekly";
  const data = await vendorService.getVendorPerformance(
    vendorId,
    period as any,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor performance fetched successfully",
    data,
  });
});

const getSingleVendorStats = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  const filters = pick(req.query, ["period", "lowStockThreshold"]);
  if (!vendorId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required in path");
  }

  const threshold = filters?.lowStockThreshold
    ? Number(filters.lowStockThreshold)
    : undefined;

  // Call the service. Let any error bubble up — catchAsync will forward it to your global error handler.
  const stats = await vendorService?.getVendorDashboardStats(
    vendorId,
    filters?.period as Period,
    threshold,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Vendor dashboard stats fetched successfully",
    data: stats,
  });
});

const getSalesTimeSeries = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const days = req.query.days ? Number(req.query.days) : 30;
  if (isNaN(days) || days <= 0)
    throw new ApiError(httpStatus.BAD_REQUEST, "days must be positive number");

  const data = await vendorService.getSalesTimeSeries(vendorId, days);
  res.status(httpStatus.OK).json({ success: true, data });
});

const getRevenueByCategory = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const days = req.query.days ? Number(req.query.days) : 30;
  if (isNaN(days) || days <= 0)
    throw new ApiError(httpStatus.BAD_REQUEST, "days must be positive number");

  const data = await vendorService.getRevenueByCategory(vendorId, days);
  res.status(httpStatus.OK).json({ success: true, data });
});

const getTopProducts = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : 10;
  const days = req.query.days ? Number(req.query.days) : 30;
  if (isNaN(days) || days <= 0)
    throw new ApiError(httpStatus.BAD_REQUEST, "days must be positive number");

  const data = await vendorService.getTopProducts(vendorId, limit, days);
  res.status(httpStatus.OK).json({ success: true, data });
});

const getOrdersByStatus = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const data = await vendorService.getOrdersByStatus(vendorId);
  res.status(httpStatus.OK).json({ success: true, data });
});
const vendorController = {
  createVendorHandler,
  getPaginatedVendorsHandler,
  updateVendorHandler,
  deleteVendorHandler,
  updateVendorStatusHandler,
  getMyVendorDetailsHandler,
  updateVendorRazorpayAccount,
  getVendorPerformanceHandler,
  getSalesByCategoryHandler,
  getTopVendorsHandler,
  getVendorStatsHandler,
  getSingleVendorStats,
  getOrdersByStatus,
  getTopProducts,
  getRevenueByCategory,
  getSalesTimeSeries,
  createVendorAdminHandler,
};

export default vendorController;
