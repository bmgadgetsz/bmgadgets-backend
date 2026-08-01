import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import {
  OrderStatus,
  Prisma,
  VendorOnboardingStatus,
  VendorProfile,
} from "@/generated/prisma";
import { sendMail } from "@/services/transporter.service";
import { VendorRegisterBody } from "@/types";
import ApiError from "@/utils/ApiError";
import isValidObjectId from "@/utils/isValidObjectId";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { getPeriodRange, percentChange, Period } from "@/utils/vendorStats";
import { randomUUID } from "crypto";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { status as httpStatus } from "http-status";

const createVendor = async (data: VendorRegisterBody & { roleId: string }) => {
  const result = await prisma.$transaction(async (tx) => {
    // Create User
    const user = await tx.user.create({
      data: {
        name: data.contactPersonName,
        email: data.email,
        phone: data.mobileNumber,
        roleId: data.roleId,
      },
    });

    // Create VendorProfile
    const { roleId: _, ...vendorInfo } = data;
    const vendorProfile = await tx.vendorProfile.create({
      data: {
        ...vendorInfo,
        userId: user.id,
        // businessName: data.businessName,
        // natureOfBusiness: data.natureOfBusiness,
        // contactPersonName: data.contactPersonName,
        // email: data.email,
        // mobileNumber: data.mobileNumber,
        onboardingStatus:
          vendorInfo?.onboardingStatus ?? "REGISTRATION_PENDING",
      },
    });

    return { user, vendorProfile };
  });

  const { user, vendorProfile } = result;

  const employeesToBeNotified = await prisma.user.findMany({
    where: {
      OR: [
        { role: { isAdmin: true } },
        {
          role: {
            permissions: {
              some: {
                resource: "VENDOR_MANAGEMENT",
                access: { hasSome: ["WRITE", "DELETE"] },
              },
            },
          },
        },
      ],
    },
  });

  // create notifications
  await prisma.notification.createMany({
    data: employeesToBeNotified.map((e) => ({
      type: "VENDOR_ONBOARDING_REQUEST_SUBMITTED",
      title: `New vendor onboarding request from ${vendorProfile.businessName}.`,
      receiverId: e.id,
      vendorProfileId: vendorProfile.id,
    })),
  });
  await prisma.notification.create({
    data: {
      type: "VENDOR_ONBOARDING_REQUEST_SUBMITTED",
      title: "Your onboarding request has been received.",
      receiverId: user.id,
    },
  });

  // push notification via socket
  const io = getIO();
  io.to(user.id).emit("notification", {
    id: vendorProfile.id,
  });
  employeesToBeNotified.forEach((vh) => {
    io.to(vh.id).emit("notification", {
      id: vendorProfile.id,
    });
  });

  // send email
  await sendMail(
    user.email,
    " Welcome! Your Vendor Onboarding Request is Received.",
    `Hi ${user.name},<br><br>We’ve received your onboarding request. Our team will review your details and update you shortly.<br><br>Thank you for joining BMGadgets.<br><br>- Team BMGadgets`,
  );

  return result;
};

const getPaginatedVendors = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
    onboardingStatus?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    notApproved?: string;
  } & Partial<VendorProfile>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);

  const {
    search,
    isAdmin,
    active,
    createdAtFrom,
    createdAtTo,
    notApproved,
    ...filterData
  } = filters;

  const conditions: Prisma.VendorProfileWhereInput[] = [];

  // partial match
  if (search) {
    if (isValidObjectId(search)) conditions.push({ id: search });
    else
      conditions.push({
        OR: [
          "businessName",
          "email",
          "contactPersonName",
          "companyOwnerName",
          "authorizedRepresentative",
        ].map((field) => ({
          [field]: {
            contains: search,
            mode: "insensitive",
          },
        })),
      });
  }
  // exact match
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // Date range filter
  if (createdAtFrom || createdAtTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};

    if (createdAtFrom) {
      dateFilter.gte = startOfDay(new Date(createdAtFrom));
    }
    if (createdAtTo) {
      dateFilter.lte = endOfDay(new Date(createdAtTo));
    }

    conditions.push({ createdAt: dateFilter });
  }

  if (active) {
    if (active === "true") conditions.push({ isActive: true });
    else if (active === "false") conditions.push({ isActive: false });
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ isActive: true });
  }
  if (notApproved) {
    if (notApproved === "true") {
      conditions.push({
        onboardingStatus: {
          not: "KYC_APPROVED",
        },
      });
    }
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.vendorProfile.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
      include: {
        product: true,
      },
    }),
    await prisma.vendorProfile.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateVendor = async (
  vendorId: string,
  data: Prisma.VendorProfileUpdateInput,
) => {
  return prisma.$transaction(async (tx) => {
    // Update vendor profile first and include userId if needed
    const vendorProfile = await tx.vendorProfile.update({
      where: { id: vendorId },
      data,
      include: { user: true },
    });

    // If the update explicitly sets isActive = false (or true), cascade product active state
    if (Object.prototype.hasOwnProperty.call(data, "isActive")) {
      // `data.isActive` might be boolean or Prisma.Input type - normalize:
      // if it's a boolean we use it directly else skip (this is a simple guard).
      const newIsActive = (data as any).isActive;
      if (typeof newIsActive === "boolean") {
        await tx.product.updateMany({
          where: { createdById: vendorId },
          data: { active: newIsActive },
        });
        await tx.warehouse.updateMany({
          where: {
            vendorId,
          },
          data: {
            active: newIsActive,
          },
        });
      }
    }

    // If vendor email/phone changed, sync user (as previously suggested)
    const userUpdates: any = {};
    if ((data as any).email && typeof (data as any).email === "string") {
      userUpdates.email = (data as any).email;
    }
    if (
      (data as any).mobileNumber &&
      typeof (data as any).mobileNumber === "string"
    ) {
      userUpdates.phone = (data as any).mobileNumber;
    }
    if (Object.keys(userUpdates).length > 0) {
      await tx.user.update({
        where: { id: vendorProfile.userId },
        data: userUpdates,
      });
    }

    return vendorProfile;
  });
};

const deleteVendor = async (vendorId: string) => {
  return prisma.vendorProfile.delete({
    where: { id: vendorId },
  });
};

const updateVendorStatus = async (
  vendorId: string,
  newStatus: VendorOnboardingStatus,
  rejectionReason?: string,
) => {
  const approvedStatuses: VendorOnboardingStatus[] = [
    VendorOnboardingStatus.REGISTRATION_APPROVED,
    VendorOnboardingStatus.KYC_APPROVED,
  ];

  return prisma.vendorProfile.update({
    where: { id: vendorId },
    data: {
      onboardingStatus: newStatus,
      rejectionReason: rejectionReason ?? null,
      approvedAt: approvedStatuses.includes(newStatus) ? new Date() : undefined,
      isActive: newStatus === "KYC_APPROVED",
    },
  });
};

// archive user
type ArchiveOptions = {
  redact?: boolean; // when true, redact email/phone/address (irreversible)
  archivedBy?: string | null; // optional: admin id who archived
};

const archiveVendor = async (
  vendorId: string,
  options: ArchiveOptions = {},
) => {
  const { redact = false, archivedBy = null } = options;

  return prisma.$transaction(async (tx) => {
    // 1) Archive vendor profile and return the record including userId
    const vendor = await tx.vendorProfile.update({
      where: { id: vendorId },
      data: {
        isArchived: true,
        isActive: false,
        archivedAt: new Date(),
        ...(archivedBy
          ? {
              /* archivedBy: archivedBy */
            }
          : {}),
      },
      select: { id: true, userId: true },
    });

    const { userId } = vendor;

    // 2) Deactivate all products created by this vendor
    await tx.product.updateMany({
      where: { createdById: vendorId },
      data: { active: false },
    });

    await tx.warehouse.updateMany({
      where: {
        vendorId,
      },
      data: {
        active: false,
      },
    });

    // 3) Delete sessions so the vendor can't stay logged in
    await tx.session.deleteMany({
      where: { userId },
    });

    // 4) Either soft-disable or redact the user
    if (redact) {
      await tx.address.updateMany({
        where: { customerProfile: { userId } },
        data: { address: `REDACTED-${randomUUID()}` },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          active: false,
          phone: `REDACTED-${randomUUID()}`,
          email: `REDACTED-${randomUUID()}`,
        },
      });
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { active: false },
      });
    }

    return vendor;
  });
};

/**
 * Returns counts + percent changes (current period vs previous same-length period)
 *
 * NOTE: Status percent changes are computed by counting vendors CREATED during the period
 * with that status. To compute changes of "current snapshot counts" you'd need timestamps
 * for status changes.
 */
export const getVendorStatsWithChange = async (period: Period = "Weekly") => {
  const { start, end, prevStart, prevEnd } = getPeriodRange(period);

  // Helper: counts for created-in-range and optional status condition
  const countCreatedIn = async (whereExtra: any = {}) =>
    prisma.vendorProfile.count({
      where: {
        createdAt: { gte: start, lte: end },
        ...whereExtra,
      },
    });

  const countPrevCreatedIn = async (whereExtra: any = {}) =>
    prisma.vendorProfile.count({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        ...whereExtra,
      },
    });

  // Snapshot totals (current totals - not period-limited)
  const totalVendorsP = prisma.vendorProfile.count();

  // New in current period (created during current period)
  const totalNewP = countCreatedIn();
  const totalPrevNewP = countPrevCreatedIn();

  // registration pending (created in period with onboardingStatus REGISTRATION_PENDING)
  const registrationPendingNewP = countCreatedIn({
    onboardingStatus: "REGISTRATION_PENDING",
  });
  const registrationPendingPrevP = countPrevCreatedIn({
    onboardingStatus: "REGISTRATION_PENDING",
  });

  // kyc pending
  const kycPendingNewP = countCreatedIn({
    onboardingStatus: "KYC_PENDING",
  });
  const kycPendingPrevP = countPrevCreatedIn({
    onboardingStatus: "KYC_PENDING",
  });

  // kyc approved
  const kycApprovedNewP = countCreatedIn({
    onboardingStatus: "KYC_APPROVED",
  });
  const kycApprovedPrevP = countPrevCreatedIn({
    onboardingStatus: "KYC_APPROVED",
  });

  // registration rejected & kyc rejected (counts of new created-with-that-status)
  const registrationRejectedNewP = countCreatedIn({
    onboardingStatus: "REGISTRATION_REJECTED",
  });
  const registrationRejectedPrevP = countPrevCreatedIn({
    onboardingStatus: "REGISTRATION_REJECTED",
  });

  const kycRejectedNewP = countCreatedIn({
    onboardingStatus: "KYC_REJECTED",
  });
  const kycRejectedPrevP = countPrevCreatedIn({
    onboardingStatus: "KYC_REJECTED",
  });

  // composite rejected: OR of (onboardingRejected OR isArchived OR (isActive=false AND onboardingStatus=KYC_APPROVED))
  const rejectedNewP = prisma.vendorProfile.count({
    where: {
      createdAt: { gte: start, lte: end },
      OR: [
        { onboardingStatus: "REGISTRATION_REJECTED" },
        { onboardingStatus: "KYC_REJECTED" },
        { isArchived: true },
        { AND: [{ isActive: false }, { onboardingStatus: "KYC_APPROVED" }] },
      ],
    },
  });

  const rejectedPrevP = prisma.vendorProfile.count({
    where: {
      createdAt: { gte: prevStart, lte: prevEnd },
      OR: [
        { onboardingStatus: "REGISTRATION_REJECTED" },
        { onboardingStatus: "KYC_REJECTED" },
        { isArchived: true },
        { AND: [{ isActive: false }, { onboardingStatus: "KYC_APPROVED" }] },
      ],
    },
  });

  // Execute all promises in parallel
  const [
    totalVendors,
    totalNew,
    totalPrevNew,
    registrationPendingNew,
    registrationPendingPrev,
    kycPendingNew,
    kycPendingPrev,
    kycApprovedNew,
    kycApprovedPrev,
    registrationRejectedNew,
    registrationRejectedPrev,
    kycRejectedNew,
    kycRejectedPrev,
    rejectedNew,
    rejectedPrev,
  ] = await Promise.all([
    totalVendorsP,
    totalNewP,
    totalPrevNewP,
    registrationPendingNewP,
    registrationPendingPrevP,
    kycPendingNewP,
    kycPendingPrevP,
    kycApprovedNewP,
    kycApprovedPrevP,
    registrationRejectedNewP,
    registrationRejectedPrevP,
    kycRejectedNewP,
    kycRejectedPrevP,
    rejectedNewP,
    rejectedPrevP,
  ]);

  const totalChangePercent = percentChange(totalNew, totalPrevNew);
  const registrationPendingChangePercent = percentChange(
    registrationPendingNew,
    registrationPendingPrev,
  );
  const kycPendingChangePercent = percentChange(kycPendingNew, kycPendingPrev);
  const kycApprovedChangePercent = percentChange(
    kycApprovedNew,
    kycApprovedPrev,
  );
  const rejectedChangePercent = percentChange(rejectedNew, rejectedPrev);

  return {
    // snapshot
    totalVendors,

    // counts for newly created vendors in current period (useful for percent calculations)
    totalNew,
    totalChangePercent,

    registrationPendingNew,
    registrationPendingChangePercent,

    kycPendingNew,
    kycPendingChangePercent,

    kycApprovedNew,
    kycApprovedChangePercent,

    registrationRejectedNew,
    kycRejectedNew,
    rejectedNew,
    rejectedChangePercent,

    period,
    periodRange: { start: start.toISOString(), end: end.toISOString() },
    previousPeriodRange: {
      start: prevStart.toISOString(),
      end: prevEnd.toISOString(),
    },
  };
};

/**
 * Top vendors by revenue (in the given period)
 */
export const getTopVendors = async (limit = 5, period: Period = "Weekly") => {
  const { start, end } = getPeriodRange(period);

  // NOTE: filter by order.createdAt and order.status via relation
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: start, lte: end },
        status: "PAID", // change if you want other statuses included
      },
      // ensure it's linked to a Price -> ProductVariant (defensive)
      price: { productVariantId: { not: null } },
    },
    select: {
      quantity: true,
      price: {
        select: {
          price: true,
          productVariant: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  createdById: true, // VendorProfile id
                },
              },
            },
          },
        },
      },
    },
  });

  // reduce revenue by vendor
  const revenueByVendor = new Map<
    string,
    { vendorId: string; vendorName?: string | null; revenue: number }
  >();

  for (const it of items) {
    const unitPrice = Number(it.price?.price ?? 0);
    const qty = Number(it.quantity ?? 0);
    const product = it.price?.productVariant?.product;
    const vendorId = product?.createdById;
    if (!vendorId) continue;

    const revenue = unitPrice * qty;
    const existing = revenueByVendor.get(vendorId);
    if (existing) {
      existing.revenue += revenue;
    } else {
      // vendorName: we'll resolve to vendorProfile.businessName later
      revenueByVendor.set(vendorId, {
        vendorId,
        vendorName: null,
        revenue,
      });
    }
  }

  const arr = Array.from(revenueByVendor.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const top = arr.slice(0, limit);

  // fetch vendor profiles for businessName
  const vendorIds = top.map((t) => t.vendorId);
  const vendors = await prisma.vendorProfile.findMany({
    where: { id: { in: vendorIds } },
    select: {
      id: true,
      businessName: true,
      email: true,
      isActive: true,
      onboardingStatus: true,
    },
  });
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  const result = top.map((t) => ({
    vendorId: t.vendorId,
    vendorName:
      vendorMap.get(t.vendorId)?.businessName ??
      vendorMap.get(t.vendorId)?.email ??
      null,
    revenue: t.revenue,
    isActive: vendorMap.get(t.vendorId)?.isActive ?? false,
    onboardingStatus: vendorMap.get(t.vendorId)?.onboardingStatus ?? null,
  }));

  return result;
};

/**
 * Sales by category (labels + values)
 */
export const getSalesByCategory = async (
  limit = 5,
  period: Period = "Weekly",
) => {
  const { start, end } = getPeriodRange(period);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: start, lte: end }, // filter by Order.createdAt
        status: "PAID",
      },
      price: { productVariantId: { not: null } },
    },
    include: {
      price: {
        select: {
          price: true,
          productVariant: {
            select: {
              variant: {
                select: {
                  subCategory: {
                    select: {
                      category: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // accumulate revenue per category id
  const revenueByCategory = new Map<
    string,
    { categoryId: string; name: string; revenue: number }
  >();

  for (const it of items) {
    const unitPrice = Number(it.price?.price ?? 0);
    const qty = Number(it.quantity ?? 0);
    const category = it.price?.productVariant?.variant?.subCategory?.category;
    const catId = category?.id ?? "unknown";
    const revenue = unitPrice * qty;

    const existing = revenueByCategory.get(catId);
    if (existing) existing.revenue += revenue;
    else
      revenueByCategory.set(catId, {
        categoryId: catId,
        name: category?.name ?? "Other",
        revenue,
      });
  }

  const arr = Array.from(revenueByCategory.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const top = arr.slice(0, limit);

  const labels = top.map((t) => t.name);
  const values = top.map((t) => t.revenue);

  return { labels, values, raw: top };
};

/**
 * Vendor performance: vendor total sales and top products in period
 */
export const getVendorPerformance = async (
  vendorId: string,
  period: Period = "Weekly",
  limitProducts = 5,
) => {
  const { start, end } = getPeriodRange(period);

  // fetch orderItems for the vendor's products
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: start, lte: end }, // filter via Order.createdAt
        status: "PAID", // only completed sales
      },
      price: {
        productVariant: {
          product: {
            createdById: vendorId, // product.createdById === vendorProfile.id
          },
        },
      },
    },
    select: {
      quantity: true, // scalar
      price: {
        select: {
          price: true,
          productVariant: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let totalSales = 0;
  const productMap = new Map<
    string,
    {
      productId: string;
      productName?: string | null;
      revenue: number;
      qty: number;
    }
  >();

  for (const it of items) {
    const unitPrice = Number(it.price?.price ?? 0);
    const qty = Number(it.quantity ?? 0);
    const product = it.price?.productVariant?.product;
    const pid = product?.id ?? "unknown";
    const revenue = unitPrice * qty;
    totalSales += revenue;

    const existing = productMap.get(pid);
    if (existing) {
      existing.revenue += revenue;
      existing.qty += qty;
    } else {
      productMap.set(pid, {
        productId: pid,
        productName: product?.name ?? null,
        revenue,
        qty,
      });
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limitProducts);

  return {
    vendorId,
    totalSales,
    topProducts,
    period,
    periodRange: { start: start.toISOString(), end: end.toISOString() },
  };
};

const LOW_STOCK_THRESHOLD_DEFAULT = 10;

export type VendorStatResult = {
  totalSales: number;
  totalSalesPrev: number;
  totalSalesDiffPct: number | null;

  ordersCount: number;
  ordersCountPrev: number;
  ordersCountDiffPct: number | null;

  aov: number | null;
  aovPrev: number | null;
  aovDiffPct: number | null;

  lowStockCount: number;
};
/**
 * Computes vendor dashboard stats for the given period and low-stock threshold.
 * Throws ApiError on bad input or if vendor not found.
 */
const getVendorDashboardStats = async (
  vendorId: string,
  period: Period,
  lowStockThreshold = LOW_STOCK_THRESHOLD_DEFAULT,
): Promise<VendorStatResult> => {
  // confirm vendor exists (helps provide meaningful 404)
  const vendorExists = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });
  if (!vendorExists) {
    throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  const { start, end, prevStart, prevEnd } = getPeriodRange(period);

  // ----------------------
  // Fetch order items in a date range for this vendor
  // ----------------------
  const fetchOrderItemsForRange = async (s: Date, e: Date) => {
    // 1) get order ids in range (non-cancelled)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: s, lte: e },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { id: true },
    });

    if (orders.length === 0) return [];
    const orderIds = orders.map((o) => o.id);

    // 2) fetch items for productVariants owned by vendor
    const variantItemsPromise = prisma.orderItem.findMany({
      where: {
        orderId: { in: orderIds },
        price: {
          productVariant: {
            isNot: null,
            is: {
              product: {
                createdById: vendorId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        orderId: true,
        quantity: true,
        price: { select: { price: true } },
      },
    });

    // 3) fetch items for productCombos owned by vendor
    const comboItemsPromise = prisma.orderItem.findMany({
      where: {
        orderId: { in: orderIds },
        price: {
          productCombo: {
            isNot: null,
            is: {
              product: {
                createdById: vendorId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        orderId: true,
        quantity: true,
        price: { select: { price: true } },
      },
    });

    const [variantItems, comboItems] = await Promise.all([
      variantItemsPromise,
      comboItemsPromise,
    ]);

    return variantItems.concat(comboItems);
  };

  const [currentItems, prevItems] = await Promise.all([
    fetchOrderItemsForRange(start, end),
    fetchOrderItemsForRange(prevStart, prevEnd),
  ]);

  // ----------------------
  // Compute totals
  // ----------------------
  const computeFromItems = (
    items: Array<{
      orderId: string;
      quantity: number;
      price: { price: number } | null;
    }>,
  ) => {
    let sales = 0;
    const orderIdSet = new Set<string>();
    for (const it of items) {
      const unit = it.price?.price ?? 0;
      sales += unit * (it.quantity ?? 0);
      orderIdSet.add(it.orderId);
    }
    return { sales, ordersCount: orderIdSet.size };
  };

  const currentTotals = computeFromItems(currentItems);
  const prevTotals = computeFromItems(prevItems);

  const totalSales = Math.round(currentTotals.sales);
  const totalSalesPrev = Math.round(prevTotals.sales);

  const { ordersCount } = currentTotals;
  const ordersCountPrev = prevTotals.ordersCount;

  const aov = ordersCount > 0 ? totalSales / ordersCount : null;
  const aovPrev = ordersCountPrev > 0 ? totalSalesPrev / ordersCountPrev : null;

  const totalSalesDiffPct = percentChange(totalSales, totalSalesPrev);
  const ordersCountDiffPct = percentChange(ordersCount, ordersCountPrev);
  const aovDiffPct =
    aov !== null && aovPrev !== null
      ? percentChange(Math.round(aov), Math.round(aovPrev))
      : null;

  // ----------------------
  // Low-stock calculation (variants + combos)
  // ----------------------
  const vendorWarehouses = await prisma.warehouse.findMany({
    where: { vendorId },
    select: { id: true },
  });
  const warehouseIds = vendorWarehouses.map((w) => w.id);

  // Variants
  const variants = await prisma.productVariant.findMany({
    where: { product: { createdById: vendorId } },
    select: {
      id: true,
      warehouseStocks: {
        where: { warehouseId: { in: warehouseIds } },
        select: { productCount: true },
      },
    },
  });

  let variantLowStockCount = 0;
  for (const v of variants) {
    const total = v.warehouseStocks.reduce(
      (s, ws) => s + (ws.productCount ?? 0),
      0,
    );
    if (total <= lowStockThreshold) variantLowStockCount += 1;
  }

  // Combos
  const combos = await prisma.productCombo.findMany({
    where: { product: { createdById: vendorId } },
    select: {
      id: true,
      warehouseStocks: {
        where: { warehouseId: { in: warehouseIds } },
        select: { comboCount: true },
      },
    },
  });

  let comboLowStockCount = 0;
  for (const c of combos) {
    const total = c.warehouseStocks.reduce(
      (s, ws) => s + (ws.comboCount ?? 0),
      0,
    );
    if (total <= lowStockThreshold) comboLowStockCount += 1;
  }

  const lowStockCount = variantLowStockCount + comboLowStockCount;

  return {
    totalSales,
    totalSalesPrev,
    totalSalesDiffPct,

    ordersCount,
    ordersCountPrev,
    ordersCountDiffPct,

    aov: aov === null ? null : Number(aov.toFixed(2)),
    aovPrev: aovPrev === null ? null : Number(aovPrev.toFixed(2)),
    aovDiffPct,

    lowStockCount,
  };
};

/**
 * Optional helper: a version optimized for large datasets using raw Mongo aggregation
 * could be added here to replace the JS-side variant loop for low-stock and the
 * orderItem lookups. If you want that, I can provide a Mongo pipeline variant.
 */

/**
 * Sales time series: returns [{ date: 'YYYY-MM-DD', revenue, orders }]
 */
const getSalesTimeSeries = async (vendorId: string, days = 30) => {
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const end = new Date();
  const start = startOfDay(subDays(end, days - 1));

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: OrderStatus.CANCELLED },
    },
    select: { id: true, createdAt: true },
  });

  if (orders.length === 0) {
    return Array.from({ length: days }).map((_, i) => {
      const d = subDays(end, days - 1 - i);
      return { date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 };
    });
  }

  const orderIds = orders.map((o) => o.id);

  // items
  const variantItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productVariant: { is: { product: { createdById: vendorId } } } },
    },
    select: {
      orderId: true,
      quantity: true,
      price: { select: { price: true } },
      order: { select: { createdAt: true } },
    },
  });

  const comboItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productCombo: { is: { product: { createdById: vendorId } } } },
    },
    select: {
      orderId: true,
      quantity: true,
      price: { select: { price: true } },
      order: { select: { createdAt: true } },
    },
  });

  const allItems = [...variantItems, ...comboItems];

  const map = new Map<string, { revenue: number; orders: Set<string> }>();
  for (const it of allItems) {
    const day = it.order.createdAt.toISOString().slice(0, 10);
    const entry = map.get(day) ?? { revenue: 0, orders: new Set<string>() };
    entry.revenue += (it.price?.price ?? 0) * (it.quantity ?? 0);
    entry.orders.add(it.orderId);
    map.set(day, entry);
  }

  return Array.from({ length: days }).map((_, i) => {
    const d = subDays(end, days - 1 - i);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key);
    return {
      date: key,
      revenue: entry ? Math.round(entry.revenue) : 0,
      orders: entry ? entry.orders.size : 0,
    };
  });
};

/**
 * Revenue by Category
 */
const getRevenueByCategory = async (vendorId: string, days = 30) => {
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const end = new Date();
  const start = startOfDay(subDays(end, days - 1));

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: OrderStatus.CANCELLED },
    },
    select: { id: true },
  });
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);

  const variantItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productVariant: { is: { product: { createdById: vendorId } } } },
    },
    select: {
      quantity: true,
      price: {
        select: {
          price: true,
          productVariant: {
            select: {
              variant: {
                select: {
                  subCategory: {
                    select: { category: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const comboItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productCombo: { is: { product: { createdById: vendorId } } } },
    },
    select: {
      quantity: true,
      price: {
        select: {
          price: true,
          productCombo: {
            select: {
              product: {
                select: {
                  varients: {
                    take: 1,
                    select: {
                      variant: {
                        select: {
                          subCategory: {
                            select: {
                              category: { select: { id: true, name: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const revenueByCategory = new Map<
    string,
    { name: string; revenue: number }
  >();

  for (const it of variantItems) {
    const cat = it.price?.productVariant?.variant?.subCategory?.category;
    if (!cat) continue;
    const rev = (it.price?.price ?? 0) * (it.quantity ?? 0);
    const prev = revenueByCategory.get(cat.id) ?? {
      name: cat.name,
      revenue: 0,
    };
    prev.revenue += rev;
    revenueByCategory.set(cat.id, prev);
  }

  for (const it of comboItems) {
    const cat =
      it.price?.productCombo?.product?.varients?.[0]?.variant?.subCategory
        ?.category;
    if (!cat) continue;
    const rev = (it.price?.price ?? 0) * (it.quantity ?? 0);
    const prev = revenueByCategory.get(cat.id) ?? {
      name: cat.name,
      revenue: 0,
    };
    prev.revenue += rev;
    revenueByCategory.set(cat.id, prev);
  }

  return Array.from(revenueByCategory.values()).map((c) => ({
    category: c.name,
    revenue: Math.round(c.revenue),
  }));
};

/**
 * Top Products by Revenue
 */
const getTopProducts = async (vendorId: string, limit = 10, days = 30) => {
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const end = new Date();
  const start = startOfDay(subDays(end, days - 1));

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: OrderStatus.CANCELLED },
    },
    select: { id: true },
  });
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);

  const variantItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productVariant: { is: { product: { createdById: vendorId } } } },
    },
    select: {
      quantity: true,
      price: {
        select: {
          price: true,
          productVariant: {
            select: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const comboItems = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productCombo: { is: { product: { createdById: vendorId } } } },
    },
    select: {
      quantity: true,
      price: {
        select: {
          price: true,
          productCombo: {
            select: { product: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const revenueByProduct = new Map<
    string,
    { name: string; revenue: number; qty: number }
  >();

  for (const it of variantItems) {
    const p = it.price?.productVariant?.product;
    if (!p) continue;
    const rev = (it.price?.price ?? 0) * (it.quantity ?? 0);
    const prev = revenueByProduct.get(p.id) ?? {
      name: p.name,
      revenue: 0,
      qty: 0,
    };
    prev.revenue += rev;
    prev.qty += it.quantity ?? 0;
    revenueByProduct.set(p.id, prev);
  }

  for (const it of comboItems) {
    const p = it.price?.productCombo?.product;
    if (!p) continue;
    const rev = (it.price?.price ?? 0) * (it.quantity ?? 0);
    const prev = revenueByProduct.get(p.id) ?? {
      name: p.name,
      revenue: 0,
      qty: 0,
    };
    prev.revenue += rev;
    prev.qty += it.quantity ?? 0;
    revenueByProduct.set(p.id, prev);
  }

  return Array.from(revenueByProduct.entries())
    .map(([productId, v]) => ({
      productId,
      name: v.name,
      revenue: Math.round(v.revenue),
      totalQuantity: v.qty,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
};

const getOrdersByStatus = async (vendorId: string) => {
  if (!vendorId)
    throw new ApiError(httpStatus.BAD_REQUEST, "vendorId required");

  const orders = await prisma.order.findMany({
    where: { status: { not: OrderStatus.CANCELLED } },
    select: { id: true, status: true },
  });
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);

  const variantMatches = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productVariant: { is: { product: { createdById: vendorId } } } },
    },
    select: { orderId: true },
  });

  const comboMatches = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      price: { productCombo: { is: { product: { createdById: vendorId } } } },
    },
    select: { orderId: true },
  });

  const vendorOrderIds = new Set<string>([
    ...variantMatches.map((m) => m.orderId),
    ...comboMatches.map((m) => m.orderId),
  ]);

  const statusCounts = new Map<string, number>();
  for (const o of orders) {
    if (!vendorOrderIds.has(o.id)) continue;
    statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  }

  return Array.from(statusCounts.entries()).map(([status, count]) => ({
    status,
    count,
  }));
};
const vendorService = {
  createVendor,
  getPaginatedVendors,
  updateVendor,
  deleteVendor,
  updateVendorStatus,
  archiveVendor,
  getTopVendors,
  getSalesByCategory,
  getVendorPerformance,
  getVendorStatsWithChange,
  getVendorDashboardStats,
  getOrdersByStatus,
  getTopProducts,
  getRevenueByCategory,
  getSalesTimeSeries,
};

export default vendorService;
