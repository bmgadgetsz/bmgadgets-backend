import prisma from "@/config/prisma";
import { OrderItem, OrderStatus, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createOrderItem = async (data: OrderItem) => {
  return prisma.orderItem.create({ data });
};

const getOrderItemById = async (id: string) => {
  return prisma.orderItem.findUnique({ where: { id } });
};

const getPaginatedCategories = async (
  filters: {
    search?: string;
    vendorProfileId?: string;
    cycleStart?: string;
    cycleEnd?: string;
    orderStatus?: OrderStatus;
  } & Partial<OrderItem>,
  options: PaginationOptions,
) => {
  const { limit: take, skip: _s, page } = calculatePagination(options);
  const {
    search,
    vendorProfileId,
    orderStatus,
    cycleStart,
    cycleEnd,
    ...filterData
  } = filters;

  const conditions: Prisma.OrderItemWhereInput[] = [];

  if (vendorProfileId)
    conditions.push({
      price: { productVariant: { product: { createdById: vendorProfileId } } },
    });
  if (orderStatus)
    conditions.push({
      order: {
        ...(orderStatus === "CANCELLED"
          ? {
              OR: [
                { status: orderStatus },
                {
                  status: "PENDING",
                  createdAt: { lte: new Date(Date.now() - 10 * 60 * 1000) },
                },
              ],
            }
          : { status: orderStatus }),
      },
    });
  if (cycleStart)
    conditions.push({ order: { createdAt: { gte: new Date(cycleStart) } } });
  if (cycleEnd)
    conditions.push({ order: { createdAt: { lte: new Date(cycleEnd) } } });

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
    await prisma.orderItem.findMany({
      where: whereConditions,
    }),
    await prisma.orderItem.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateOrderItem = async (id: string, data: Partial<OrderItem>) => {
  return prisma.orderItem.update({ where: { id }, data });
};

const deleteOrderItem = async (id: string) => {
  return prisma.orderItem.delete({ where: { id } });
};

const orderItemService = {
  createOrderItem,
  getOrderItemById,
  getPaginatedCategories,
  updateOrderItem,
  deleteOrderItem,
};
export default orderItemService;
