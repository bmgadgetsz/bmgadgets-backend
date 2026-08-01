import prisma from "@/config/prisma";
import { ProductCombo, Prisma } from "@/generated/prisma";
import ApiError from "@/utils/ApiError";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { status as httpStatus } from "http-status";

const createProductCombo = async (
  data: ProductCombo & {
    items: Prisma.ComboItemCreateManyInput[];
    price: number;
  },
) => {
  const { items, price, ...comboData } = data;
  return prisma.$transaction(async (tx) => {
    const productCombo = await tx.productCombo.create({
      data: {
        ...comboData,
        items: { createMany: { data: items } },
        prices: { create: { price } },
      },
    });

    return productCombo;
  });
};

const getProductComboById = async (id: string) => {
  return prisma.productCombo.findUnique({ where: { id } });
};

const getPaginatedProductCombos = async (
  filters: {
    search?: string;
    vendorId?: string;
    isAdmin?: string;
    active?: string;
  } & Partial<ProductCombo>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, isAdmin, active, vendorId, ...filterData } = filters;

  const conditions: Prisma.ProductComboWhereInput[] = [];

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
  if (vendorId) conditions.push({ product: { createdById: vendorId } });
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
    await prisma.productCombo.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      include: {
        product: { select: { id: true, name: true, createdById: true } },
        prices: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { price: true },
        },
        items: {
          include: {
            productVariant: {
              select: {
                productId: true,
                product: { select: { name: true } },
                variant: { select: { name: true } },
              },
            },
          },
        },
      },
      skip,
      take,
    }),
    await prisma.productCombo.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateProductCombo = (
  id: string,
  data: Partial<ProductCombo> & {
    items?: {
      quantity: number;
      productVariantId: string;
    }[];
    price?: number;
  },
) => {
  const { items, price, ...productCombo } = data;

  return prisma.$transaction(async (tx) => {
    const productComboData = await tx.productCombo.update({
      where: { id },
      data: productCombo,
      include: { items: true },
    });

    if (items) {
      await tx.comboItem.deleteMany({
        where: { productComboId: productComboData.id },
      });

      await tx.comboItem.createMany({
        data: items!.map((item) => ({
          productComboId: productComboData.id,
          ...item,
        })),
      });
    }

    if (price) {
      await tx.price.updateMany({
        where: { productComboId: productComboData.id },
        data: { active: false },
      });
      await tx.price.create({
        data: {
          price,
          productComboId: productComboData.id,
        },
      });
    }

    return productComboData;
  });
};

const deleteProductCombo = async (id: string) => {
  const inOrder = await prisma.orderItem.findFirst({
    where: { price: { productComboId: id } },
  });
  if (inOrder)
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Cannot delete product combo as it is associated with existing orders",
    );

  return prisma.productCombo.delete({ where: { id } });
};

const productComboService = {
  createProductCombo,
  getProductComboById,
  getPaginatedProductCombos,
  updateProductCombo,
  deleteProductCombo,
};
export default productComboService;
