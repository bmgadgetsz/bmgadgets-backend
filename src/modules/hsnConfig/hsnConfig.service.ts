import prisma from "@/config/prisma";
import { HsnConfig, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createHsnConfig = async (data: HsnConfig) => {
  return prisma.hsnConfig.create({ data });
};

const createManyHsnConfig = async (data: HsnConfig[]) => {
  return prisma.hsnConfig.createMany({ data });
};

const getHsnConfigById = async (id: string) => {
  return prisma.hsnConfig.findUnique({ where: { id } });
};

const getPaginatedHsnConfigs = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<HsnConfig>,
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

  const conditions: Prisma.HsnConfigWhereInput[] = [];

  // partial match
  if (search) {
    conditions.push({
      OR: ["hsnCode"].map((field) => ({
        [field]: {
          startsWith: search,
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
    await prisma.hsnConfig.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.hsnConfig.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateHsnConfig = async (id: string, data: Partial<HsnConfig>) => {
  return prisma.hsnConfig.update({ where: { id }, data });
};

const deleteHsnConfig = async (id: string) => {
  return prisma.hsnConfig.delete({ where: { id } });
};

const hsnConfigService = {
  createHsnConfig,
  getHsnConfigById,
  createManyHsnConfig,
  getPaginatedHsnConfigs,
  updateHsnConfig,
  deleteHsnConfig,
};
export default hsnConfigService;
