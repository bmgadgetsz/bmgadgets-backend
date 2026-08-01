import prisma from "@/config/prisma";
import { Coupon, Prisma } from "@/generated/prisma";
import ApiError from "@/utils/ApiError";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { status as httpStatus } from "http-status";

const createCoupon = async (
  data: Coupon & {
    categoryIds: string[];
  },
) => {
  const { categoryIds, ...couponData } = data;

  if (couponData.minimumOrderAmount >= couponData.maximumOrderAmount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Minimum order amount is always less then maximum order amount",
    );
  }

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({ data: couponData });

    if (data.categoryIds.length !== 0) {
      await tx.couponCategories.createMany({
        data: categoryIds.map((categoryId) => ({
          couponId: coupon.id,
          categoryId,
        })),
      });
    }

    return tx.coupon.findUnique({
      where: { id: coupon.id },
      include: { applicableFor: true },
    });
  });
};

const getCouponById = async (id: string) => {
  return prisma.coupon.findUnique({ where: { id } });
};

const getPaginatedCoupons = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<Coupon>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, isAdmin, active, ...filterData } = filters;

  const conditions: Prisma.CouponWhereInput[] = [];

  if (filterData.code) {
    conditions.push({
      code: filterData.code,
    });
  }

  // partial match
  if (search) {
    conditions.push({
      OR: ["code"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }

  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ active: true });
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

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.coupon.findMany({
      where: whereConditions,
      include: { applicableFor: true },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.coupon.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateCoupon = async (
  id: string,
  data: Partial<Coupon> & {
    categoryIds: string[];
  },
) => {
  const { categoryIds, ...couponData } = data;

  return prisma.$transaction(async (tx) => {
    const oldCoupon = await tx.coupon.findUnique({ where: { id } });

    if (!oldCoupon) {
      throw new ApiError(httpStatus.NOT_FOUND, "Coupon not found");
    }

    if (
      (couponData?.minimumOrderAmount ?? oldCoupon.minimumOrderAmount) >=
      (couponData.maximumOrderAmount ?? oldCoupon.maximumOrderAmount)
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Minimum order amount is always less then maximum order amount",
      );
    }
    const coupon = await tx.coupon.update({
      where: { id },
      data: couponData,
    });

    if (categoryIds && categoryIds.length > 0) {
      await tx.couponCategories.deleteMany({ where: { couponId: coupon.id } });

      await tx.couponCategories.createMany({
        data: categoryIds.map((categoryId) => ({
          couponId: coupon.id,
          categoryId,
        })),
      });
    }

    return tx.coupon.findUnique({
      where: { id },
      include: { applicableFor: true },
    });
  });
};

const deleteCoupon = async (id: string) => {
  return prisma.coupon.delete({ where: { id } });
};

const couponService = {
  createCoupon,
  getCouponById,
  getPaginatedCoupons,
  updateCoupon,
  deleteCoupon,
};
export default couponService;
