import prisma from "@/config/prisma";
import { Prisma, WarehouseStock } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createStock = async (data: WarehouseStock) => {
  return prisma.warehouseStock.create({ data });
};

const updateStock = async (id: string, data: Partial<WarehouseStock>) => {
  return prisma.warehouseStock.update({ where: { id }, data });
};

const getPaginatedVariantStock = async (
  filters: {
    search?: string;
    productVariantId?: string;
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

  const { search, productVariantId } = filters;

  const conditions: Prisma.WarehouseStockWhereInput[] = [];

  // Filter by productId
  if (productVariantId) conditions.push({ productVariantId });

  // Partial search on variant or product name
  if (search) {
    conditions.push({
      OR: [
        {
          productVariant: {
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
    prisma.warehouseStock.findMany({
      where: whereConditions,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder || "asc" } : undefined,
      include: {
        warehouse: true,
      },
    }),
    prisma.warehouseStock.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const deleteVariantStock = (id: string) => {
  return prisma.warehouseStock.delete({ where: { id } });
};

const warehouseStockService = {
  createStock,
  updateStock,
  deleteVariantStock,
  getPaginatedVariantStock,
};
export default warehouseStockService;
