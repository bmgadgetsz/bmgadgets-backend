import prisma from "@/config/prisma";
import { Prisma, SubCategory } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createSubCategory = async (data: SubCategory) => {
  return prisma.subCategory.create({ data });
};

const createManySubCategory = async (data: SubCategory[]) => {
  return prisma.subCategory.createMany({ data });
};

const getSubCategoryById = async (id: string) => {
  return prisma.subCategory.findUnique({ where: { id } });
};

const getPaginatedSubCategories = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<SubCategory>,
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

  const conditions: Prisma.SubCategoryWhereInput[] = [];

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
    await prisma.subCategory.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.subCategory.count({ where: { ...whereConditions } }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateSubCategory = async (id: string, data: Partial<SubCategory>) => {
  return prisma.subCategory.update({ where: { id }, data });
};

const deleteSubCategory = async (id: string) => {
  return prisma.subCategory.delete({ where: { id } });
};

const subCategoryService = {
  createSubCategory,
  createManySubCategory,
  getSubCategoryById,
  getPaginatedSubCategories,
  updateSubCategory,
  deleteSubCategory,
};
export default subCategoryService;
