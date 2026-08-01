import prisma from "@/config/prisma";
import { Prisma, Variant } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createVariant = async (data: Variant) => {
  return prisma.variant.create({ data });
};

const getVariantById = async (id: string) => {
  return prisma.variant.findUnique({
    where: { id },
    include: { subCategory: true },
  });
};

const getPaginatedVariants = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<Variant>,
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

  const conditions: Prisma.VariantWhereInput[] = [];

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

  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ active: true });
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.variant.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      include: { subCategory: true },
      skip,
      take,
    }),
    await prisma.variant.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateVariant = async (id: string, data: Partial<Variant>) => {
  return prisma.variant.update({ where: { id }, data });
};

const deleteVariant = async (id: string) => {
  return prisma.variant.delete({ where: { id } });
};

const variantService = {
  createVariant,
  getVariantById,
  getPaginatedVariants,
  updateVariant,
  deleteVariant,
};
export default variantService;
