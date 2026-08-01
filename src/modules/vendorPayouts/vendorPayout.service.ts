import prisma from "@/config/prisma";
import {
  OrderItem,
  Price,
  Prisma,
  ProductCombo,
  ProductVariant,
  VendorPayout,
  VendorPayoutItem,
  VendorPayoutStatus,
} from "@/generated/prisma";
import { LatestPayoutDTO, PayoutRow } from "@/types/payout";
import ApiError from "@/utils/ApiError";
import isValidObjectId from "@/utils/isValidObjectId";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { format, startOfDay } from "date-fns";
import { status as httpStatus } from "http-status";

const calculateSinglePayoutNetPayout = (
  payout: VendorPayout & {
    items: (VendorPayoutItem & {
      orderItem: OrderItem & {
        price: Price & {
          productVariant: ProductVariant | null;
          productCombo: ProductCombo | null;
        };
      };
    })[];
  },
) => {
  const grossSale = payout!.items!.reduce((sum, item) => {
    const basePrice = item.orderItem.price.price;
    const discountPercentage =
      item.orderItem.price.productVariant?.discountPercentage ?? 0;
    const finalPrice = basePrice - basePrice * (discountPercentage / 100);

    return sum + finalPrice * item.orderItem.quantity;
  }, 0);

  const totalCommission = payout!.items!.reduce(
    (sum, item) =>
      sum +
      item.orderItem.price.price *
      item.orderItem.quantity *
      (item.commission / 100),
    0,
  );

  const payoutGst = totalCommission * 0.18;
  const netPayment =
    grossSale - (totalCommission + payoutGst + (payout!.marketFee ?? 0));

  return netPayment;
};

const calculateNetPayout = (
  payouts: (VendorPayout & {
    items: (VendorPayoutItem & {
      orderItem: OrderItem & {
        price: Price & {
          productVariant: ProductVariant | null;
          productCombo: ProductCombo | null;
        };
      };
    })[];
  })[],
) => {
  return payouts.reduce((acc, curr) => {
    // ✅ Calculate net payment
    const grossSale = curr!.items!.reduce((sum, item) => {
      const basePrice = item.orderItem.price.price;
      const discountPercentage =
        item.orderItem.price.productVariant?.discountPercentage ?? 0;
      const finalPrice = basePrice - basePrice * (discountPercentage / 100);

      return sum + finalPrice * item.orderItem.quantity;
    }, 0);

    const totalCommission = curr!.items!.reduce(
      (sum, item) =>
        sum +
        item.orderItem.price.price *
        item.orderItem.quantity *
        (item.commission / 100),
      0,
    );

    const payoutGst = totalCommission * 0.18;
    const netPayment =
      grossSale - (totalCommission + payoutGst + (curr!.marketFee ?? 0));

    return acc + netPayment;
  }, 0);
};

const createVendorPayout = async (data: VendorPayout) => {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: { createdAt: { gte: data.cycleStart, lte: data.cycleEnd } },
      price: {
        OR: [
          {
            productVariant: { product: { createdById: data.vendorProfileId } },
          },
          {
            productCombo: { product: { createdById: data.vendorProfileId } },
          },
        ],
      },
    },
  });

  return prisma.$transaction(async (tx) => {
    const newPayout = await tx.vendorPayout.create({
      data,
    });

    if (orderItems.length)
      await tx.vendorPayoutItem.createMany({
        data: orderItems.map((item) => ({
          vendorPayoutId: newPayout.id,
          orderItemId: item.id,
          commission: 0,
        })),
      });
    return newPayout;
  });
};

const getVendorPayoutById = async (id: string) => {
  const data = await prisma.vendorPayout.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          orderItem: {
            include: {
              price: {
                include: {
                  productVariant: { include: { product: true } },
                  productCombo: { include: { product: true } },
                },
              },
            },
          },
        },
      },
      vendorProfile: { include: { user: true } },
    },
  });

  return {
    ...data,
    items: data?.items.map((item) => {
      const itemType = item.orderItem.price.productVariant
        ? "productVariant"
        : "productCombo";
      const basePrice = item.orderItem.price.price;
      const discountPercentage =
        item.orderItem.price.productVariant?.discountPercentage ?? 0;
      const finalPrice = basePrice - basePrice * (discountPercentage / 100);

      return {
        productName: item.orderItem.price[itemType]?.product.name,
        orderId: item.orderItem.orderId,
        orderItemId: item.orderItemId,
        quantity: item.orderItem.quantity,
        unitPrice: finalPrice,
        commission: item.commission,
        note: item.note,
        orderItem: item.orderItem,
      };
    }),
  };
};

const getPaginatedVendorPayouts = async (
  filters: {
    search?: string;
    from?: string;
    to?: string;
  } & Partial<VendorPayout>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, from, to, ...filterData } = filters;

  const conditions: Prisma.VendorPayoutWhereInput[] = [];

  // partial match
  if (search) {
    if (isValidObjectId(search)) conditions.push({ id: search });
    else
      conditions.push({
        vendorProfile: {
          businessName: { contains: search, mode: "insensitive" },
        },
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

  // date range filter
  if (from || to) {
    const range: Prisma.VendorPayoutWhereInput = {};
    if (from) range.cycleStart = { gte: new Date(from) };
    if (to) range.cycleEnd = { lte: new Date(to) };
    conditions.push(range);
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.vendorPayout.findMany({
      where: whereConditions,
      include: {
        vendorProfile: { include: { user: true } },
        items: {
          include: {
            orderItem: {
              include: { price: { include: { productVariant: true } } },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.vendorPayout.count({ where: whereConditions }),
  ]);

  // gross sale, commission, net payment
  const data = result.map((payout) => {
    const { items, ...payoutData } = payout;
    const grossSale = items.reduce((sum, item) => {
      return sum + item.orderItem.price.price * item.orderItem.quantity;
    }, 0);

    const totalCommission = items.reduce((sum, item) => {
      const basePrice = item.orderItem.price.price * item.orderItem.quantity;
      return sum + basePrice * (item.commission / 100);
    }, 0);

    const netPayment = grossSale - totalCommission - totalCommission * 0.18;

    return {
      ...payoutData,
      grossSale,
      totalCommission,
      netPayment: netPayment - payoutData.marketFee,
    };
  });

  return {
    meta: { total, page, limit: take },
    data,
  };
};

const updateVendorPayout = async (
  id: string,
  data: Partial<VendorPayout> & {
    items?: VendorPayoutItem[];
  },
) => {
  const { items, ...vendorPayoutData } = data;

  return prisma.$transaction(async (tx) => {
    const vendorData = await tx.vendorPayout.findUnique({ where: { id } });

    if (!vendorData) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor payout not found");
    }

    const vendorPayout = await tx.vendorPayout.update({
      where: { id },
      data: vendorPayoutData,
    });

    if (items && items.length > 0) {
      await tx.vendorPayoutItem.deleteMany({
        where: { vendorPayoutId: vendorPayout.id },
      });

      await tx.vendorPayoutItem.createMany({
        data: items.map((item) => ({
          vendorPayoutId: vendorPayout.id,
          orderItemId: item.orderItemId,
          commission: item.commission,
          note: item.note,
        })),
      });
    }

    return tx.vendorPayout.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            orderItem: {
              include: { price: { include: { productVariant: true } } },
            },
          },
        },
        vendorProfile: true,
      },
    });
  });
};

const deleteVendorPayout = async (id: string) => {
  return prisma.vendorPayout.delete({ where: { id } });
};

export async function getLatestVendorPayoutBreakdown(
  vendorProfileId: string,
  statusFilter?: VendorPayoutStatus,
): Promise<LatestPayoutDTO | null> {
  const latest = await prisma.vendorPayout.findFirst({
    where: {
      vendorProfileId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cycleStart: true,
      cycleEnd: true,
      status: true,
      marketFee: true, // ✅ include this
      items: {
        select: {
          commission: true, // percentage value
          orderItem: {
            select: {
              quantity: true,
              order: {
                select: {
                  id: true,
                  razorpayOrderId: true,
                },
              },
              price: {
                select: {
                  price: true,
                  productVariant: {
                    select: {
                      product: { select: { name: true } },
                      variant: { select: { name: true } },
                    },
                  },
                  productCombo: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!latest) return null;

  // 1) Gross sale & total commission
  // const grossSale = latest.items.reduce(
  //   (sum, pi) =>
  //     sum + (pi.orderItem.price?.price ?? 0) * (pi.orderItem.quantity ?? 0),
  //   0,
  // );

  const totalCommission = latest.items.reduce((sum, pi) => {
    const qty = pi.orderItem.quantity ?? 0;
    const unit = pi.orderItem.price?.price ?? 0;
    const salePrice = unit * qty;
    return sum + salePrice * (pi.commission / 100);
  }, 0);

  // 2) GST on commission
  const gstTotal = totalCommission * 0.18;

  const marketFeeShare = latest.marketFee ?? 0;

  const rows: PayoutRow[] = latest.items.map((pi) => {
    const oi = pi.orderItem;
    const qty = oi.quantity ?? 0;
    const unit = oi.price?.price ?? 0;
    const salePrice = unit * qty;

    const commission = salePrice * (pi.commission / 100);

    // proportional GST share
    const gstShare =
      totalCommission > 0 ? (commission / totalCommission) * gstTotal : 0;

    // proportional market fee share

    const netToVendor = salePrice - (commission + gstShare);
    const pv = oi.price?.productVariant;
    const combo = oi.price?.productCombo;
    const productName = pv
      ? [pv.product?.name, pv.variant?.name].filter(Boolean).join(" - ")
      : (combo?.name ?? "—");

    const orderCode =
      oi.order?.razorpayOrderId ??
      `ORD${String(oi.order?.id ?? "")
        .slice(-6)
        .toUpperCase()}`;

    return {
      productName,
      orderCode,
      salePrice: Math.round(salePrice),
      commission: -Math.round(commission),
      gst: -Math.round(gstShare),
      netToVendor: Math.round(netToVendor),
    };
  });

  const totals = rows.reduce(
    (a, r) => ({
      salePrice: a.salePrice + r.salePrice,
      commission: a.commission + r.commission,
      gst: a.gst + r.gst,
      netToVendor: a.netToVendor + r.netToVendor,
    }),
    { salePrice: 0, commission: 0, gst: 0, netToVendor: 0 },
  );

  return {
    payoutId: latest.id,
    cycleStart: latest.cycleStart,
    cycleEnd: latest.cycleEnd,
    status: latest.status,
    rows,
    totals: {
      ...totals,
      netToVendor: totals.netToVendor - marketFeeShare,
      marketFeeShare,
    },
  };
}

type SummaryOpts = {
  vendorProfileId: string;
  // optional filters
  status?: VendorPayoutStatus; // e.g. COMPLETED only
  from?: Date; // cycle range filter (optional)
  to?: Date; // cycle range filter (optional)
};

export const getVendorPayoutSummary = async (opts: SummaryOpts) => {
  const { vendorProfileId, status, from, to } = opts;

  // Build where
  const where: Prisma.VendorPayoutWhereInput = {
    vendorProfileId,
    ...(status ? { status } : {}),
    ...(from || to
      ? {
        AND: [
          from ? { cycleStart: { gte: from } } : {},
          to ? { cycleEnd: { lte: to } } : {},
        ],
      }
      : {}),
  };

  // Select only what we need (avoid Order.status enum)
  const payouts = await prisma.vendorPayout.findMany({
    where,
    select: {
      marketFee: true,
      items: {
        select: {
          commission: true, // percentage
          orderItem: {
            select: {
              quantity: true,
              price: { select: { price: true } },
            },
          },
        },
      },
    },
  });

  const returnRequests = await prisma.returnRequest.findMany({
    where: {
      orderItem: {
        price: {
          OR: [
            { productVariant: { product: { createdById: vendorProfileId } } },
            { productCombo: { product: { createdById: vendorProfileId } } },
          ],
        },
      },
      status: "REFUNDED",
      ...(from || to
        ? {
          AND: [
            from ? { createdAt: { gte: from } } : {},
            to ? { createdAt: { lte: to } } : {},
          ],
        }
        : {}),
    },
    include: {
      orderItem: { include: { price: { include: { productVariant: true } } } },
    },
  });

  // Aggregate
  let grossSale = 0;
  let totalCommission = 0;
  let totalMarketFee = 0;

  for (const p of payouts) {
    totalMarketFee += p.marketFee ?? 0;

    for (const it of p.items) {
      const qty = it.orderItem.quantity ?? 0;
      const unit = it.orderItem.price?.price ?? 0;
      const sale = unit * qty;
      grossSale += sale;
      totalCommission += sale * (it.commission / 100);
    }
  }

  const gst = totalCommission * 0.18; // GST on total commission
  const netPayable = grossSale - (totalCommission + gst + totalMarketFee);

  return {
    grossSale: Math.round(grossSale),
    commission: Math.round(totalCommission),
    gst: Math.round(gst),
    marketFee: Math.round(totalMarketFee),
    netPayable: Math.round(netPayable),
    payoutCount: payouts.length,
    returnAmount: returnRequests.reduce((acc, curr) => {
      const basePrice = curr.orderItem.price.price;
      const discountPercentage =
        curr.orderItem.price.productVariant?.discountPercentage ?? 0;
      const finalPrice = basePrice - basePrice * (discountPercentage / 100);

      return acc + finalPrice * curr.quantity;
    }, 0),
  };
};

const getPayoutStats = async ({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) => {
  const totalVendors = await prisma.vendorProfile.count({
    where: {
      isActive: true,
      onboardingStatus: "REGISTRATION_APPROVED",
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
  });

  const {
    _sum: { couponDiscount, gst, subtotal },
  } = await prisma.order.aggregate({
    where: {
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
    _sum: { couponDiscount: true, subtotal: true, gst: true },
  });
  const grossSales = (subtotal ?? 0) + (couponDiscount ?? 0) + (gst ?? 0);

  const pendingPayouts = await prisma.vendorPayout.findMany({
    where: {
      status: { not: "COMPLETED" },
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
    include: {
      items: {
        include: {
          orderItem: {
            include: {
              price: { include: { productVariant: true, productCombo: true } },
            },
          },
        },
      },
    },
  });
  const pendingPayoutAmount = calculateNetPayout(pendingPayouts);

  const completedPayouts = await prisma.vendorPayout.findMany({
    where: {
      status: "COMPLETED",
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
    include: {
      items: {
        include: {
          orderItem: {
            include: {
              price: { include: { productVariant: true, productCombo: true } },
            },
          },
        },
      },
    },
  });
  const completePayoutAmount = calculateNetPayout(completedPayouts);
  // for single
  const dailyTotals: Record<string, number> = {};

  for (const payout of completedPayouts) {
    const dayKey = format(startOfDay(payout.createdAt), "yyyy-MM-dd");
    const payoutAmount = calculateSinglePayoutNetPayout(payout);

    dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + payoutAmount;
  }

  // 2️⃣ Convert to chart-friendly array
  const completedPayoutsSalesTrend = Object.entries(dailyTotals)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const failedPayouts = await prisma.vendorPayout.findMany({
    where: {
      status: { in: ["FAILED", "REVERSED"] },
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
    include: {
      items: {
        include: {
          orderItem: {
            include: {
              price: { include: { productVariant: true, productCombo: true } },
            },
          },
        },
      },
    },
  });
  const failedPayoutAmount = calculateNetPayout(failedPayouts);

  return {
    totalVendors,
    grossSales,
    pendingPayoutAmount,
    completePayoutAmount,
    failedPayoutAmount,
    payoutCounts: {
      completed: completedPayouts.length,
      pending: pendingPayouts.length,
      failed: failedPayouts.length,
    },
    completedPayoutsSalesTrend,
  };
};

const vendorPayoutService = {
  createVendorPayout,
  getVendorPayoutById,
  getPaginatedVendorPayouts,
  updateVendorPayout,
  deleteVendorPayout,
  getLatestVendorPayoutBreakdown,
  getVendorPayoutSummary,
  getPayoutStats,
};
export default vendorPayoutService;
