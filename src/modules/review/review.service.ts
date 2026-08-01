import prisma from "@/config/prisma";
import { Prisma, Review } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createReview = async (data: Review) => {
  return prisma.review.create({ data });
};

const getReviewById = async (id: string) => {
  return prisma.review.findUnique({
    where: { id },
    include: {
      createdBy: { select: { user: { select: { name: true } } } },
      product: { select: { name: true } },
    },
  });
};

const getPaginatedReviews = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<Review>,
  options: PaginationOptions,
) => {
  const { search, active, isAdmin, ...filterData } = filters;

  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);

  const conditions: Prisma.ReviewWhereInput[] = [];

  if (active) {
    if (active === "true") conditions.push({ approved: true });
    else if (active === "false") conditions.push({ approved: false });
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ approved: true });
  }

  // partial match
  if (search) {
    conditions.push({
      OR: ["name"].map((field) => ({
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

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.review.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: { select: { user: { select: { name: true } } } },
        product: { select: { name: true } },
      },
      skip,
      take,
    }),
    await prisma.review.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateReview = async (id: string, data: Partial<Review>) => {
  return prisma.review.update({ where: { id }, data });
};

const deleteReview = async (id: string) => {
  return prisma.review.delete({ where: { id } });
};

const reviewService = {
  createReview,
  getReviewById,
  getPaginatedReviews,
  updateReview,
  deleteReview,
};
export default reviewService;
