import prisma from "@/config/prisma";
import { Prisma, Warehouse } from "@/generated/prisma";
import {
  WarehouseCreatePayload,
  WarehouseUpdatePayload,
} from "@/types/warehouse";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createWarehouse = async (payload: WarehouseCreatePayload) => {
  return prisma.warehouse.create({
    data: payload,
  });
};

const updateWarehouse = async (
  warehouseId: string,
  payload: WarehouseUpdatePayload,
) => {
  return prisma.warehouse.update({
    where: { id: warehouseId },
    data: payload,
  });
};

const deleteWarehouse = async (warehouseId: string) => {
  return prisma.$transaction(async (tx) => {
    // Delete warehouse stocks first
    await tx.warehouseStock.deleteMany({
      where: { warehouseId },
    });

    // Delete the warehouse
    return tx.warehouse.delete({
      where: { id: warehouseId },
    });
  });
};

const getWarehouseById = async (warehouseId: string) => {
  return prisma.warehouse.findUnique({
    where: { id: warehouseId },
    include: { warehouseStocks: true },
  });
};

const getPaginatedWarehouses = async (
  filters: {
    search?: string; // search by title, city, state, country
  } & Partial<Warehouse>,
  options: PaginationOptions,
) => {
  const { search, ...filterData } = filters;
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);

  const conditions: Prisma.WarehouseWhereInput[] = [];

  if (search) {
    conditions.push({
      OR: ["title", "city", "state", "country"].map((field) => ({
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

  const [data, total] = await Promise.all([
    prisma.warehouse.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
      include: { warehouseStocks: true, vendor: true },
    }),
    prisma.warehouse.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, take },
    data,
  };
};

const warehouseService = {
  getPaginatedWarehouses,
  getWarehouseById,
  deleteWarehouse,
  createWarehouse,
  updateWarehouse,
};

export default warehouseService;
