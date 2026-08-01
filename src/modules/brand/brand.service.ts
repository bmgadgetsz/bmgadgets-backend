import prisma from "@/config/prisma";
import { Brand, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

/**
 * create a brand
 * @param data - brand data
 * @returns newly created brand
 */
const createBrand = async (data: Brand) => {
  return prisma.brand.create({ data });
};

/**
 * get a brand by id
 * @param id - id of the brand
 * @returns the brand or null
 */
const getBrandById = async (id: string) => {
  return prisma.brand.findUnique({ where: { id } });
};

/**
 * Get paginated brands
 * @param filters - apply the filters if they exists
 * @param options - apply the pagination options
 * @returns the list of paginated brand by limit
 */
const getPaginatedBrands = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<Brand>,
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

  const conditions: Prisma.BrandWhereInput[] = [];

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

  // get active/inactive product filter
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
    // for non admin only send inactive products
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ active: true });
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  // prisma query to get list of brand and total brands in the system currently
  const [result, total] = await Promise.all([
    await prisma.brand.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.brand.count({ where: whereConditions }),
  ]);

  // return the following data
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Upadte a brand by its id
 * @param id - id of the brand
 * @param data - data to be updated
 * @returns the updated brand
 */
const updateBrand = async (id: string, data: Partial<Brand>) => {
  return prisma.brand.update({ where: { id }, data });
};

/**
 * deletes a brand by id
 * @param id - id of the brand
 * @returns the deleted brand
 */
const deleteBrand = async (id: string) => {
  return prisma.brand.delete({ where: { id } });
};

const brandService = {
  createBrand,
  getBrandById,
  getPaginatedBrands,
  updateBrand,
  deleteBrand,
};
export default brandService;
