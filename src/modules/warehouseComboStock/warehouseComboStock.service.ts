import prisma from "@/config/prisma";
import { Prisma, WarehouseComboStock } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const getPaginatedComboStock = async (
  filters: {
    search?: string;
    productComboId?: string;
  },
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);

  const { search, productComboId } = filters;

  const conditions: Prisma.WarehouseComboStockWhereInput[] = [];

  // Filter by productId
  if (productComboId) conditions.push({ productComboId });

  // Partial search on variant or product name
  if (search) {
    conditions.push({
      OR: [
        {
          productCombo: {
            product: { name: { contains: search, mode: "insensitive" } },
          },
        },
        // {
        //   productVariant: {
        //     product: { description: { contains: search, mode: "insensitive" } },
        //   },
        // }, // optional
        // {
        //   productVariant: {
        //     variantId: { contains: search, mode: "insensitive" },
        //   },
        // }, // optional
      ],
    });
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};
  const [result, total] = await Promise.all([
    prisma.warehouseComboStock.findMany({
      where: whereConditions,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder || "asc" } : undefined,
      include: {
        warehouse: true,
      },
    }),
    prisma.warehouseComboStock.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const createStock = async (data: WarehouseComboStock) => {
  return prisma.warehouseComboStock.create({ data });
};

const updateStock = async (id: string, data: Partial<WarehouseComboStock>) => {
  return prisma.warehouseComboStock.update({ where: { id }, data });
};

const deleteStock = async (id: string) => {
  return prisma.warehouseComboStock.delete({ where: { id } });
};

const warehouseComboStockService = {
  createStock,
  updateStock,
  getPaginatedComboStock,
  deleteStock,
};
export default warehouseComboStockService;
