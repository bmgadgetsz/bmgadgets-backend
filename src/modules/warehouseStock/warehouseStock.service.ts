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

const upsertVariantStock = async (data: {
  productVariantId: string;
  productCount: number;
  warehouseId?: string;
}) => {
  let targetWarehouseId = data.warehouseId;
  if (!targetWarehouseId) {
    const existingWarehouse = await prisma.warehouse.findFirst();
    if (existingWarehouse) {
      targetWarehouseId = existingWarehouse.id;
    } else {
      let vendor = await prisma.vendorProfile.findFirst();
      if (!vendor) {
        let defaultUser = await prisma.user.findFirst();
        if (!defaultUser) {
          let role = await prisma.role.findFirst();
          if (!role) {
            role = await prisma.role.create({
              data: { name: "ADMIN", description: "Admin Role" },
            });
          }
          defaultUser = await prisma.user.create({
            data: {
              email: "admin@bmgadgets.com",
              name: "BMGadgets Admin",
              phone: "+910000000000",
              roleId: role.id,
            },
          });
        }
        vendor = await prisma.vendorProfile.create({
          data: {
            userId: defaultUser.id,
            businessName: "BMGadgets Store",
            natureOfBusiness: "Retail",
            contactPersonName: "Store Manager",
            email: "admin@bmgadgets.com",
            mobileNumber: "+910000000000",
          },
        });
      }
      const newWarehouse = await prisma.warehouse.create({
        data: {
          company: "BMGadgets Store",
          title: "Main Warehouse",
          contactPersonName: "Store Manager",
          email: "admin@bmgadgets.com",
          phone: "+910000000000",
          address1: "Main Store Address",
          city: "Main City",
          state: "Main State",
          country: "India",
          pincode: "600001",
          gstNo: "33AAAAA0000A1Z5",
          vendorId: vendor.id,
        },
      });
      targetWarehouseId = newWarehouse.id;
    }
  }

  const existingStock = await prisma.warehouseStock.findFirst({
    where: {
      productVariantId: data.productVariantId,
      warehouseId: targetWarehouseId,
    },
  });

  if (existingStock) {
    return prisma.warehouseStock.update({
      where: { id: existingStock.id },
      data: { productCount: data.productCount },
    });
  }
  return prisma.warehouseStock.create({
    data: {
      productVariantId: data.productVariantId,
      warehouseId: targetWarehouseId,
      productCount: data.productCount,
    },
  });
};

const deleteVariantStock = (id: string) => {
  return prisma.warehouseStock.delete({ where: { id } });
};

const warehouseStockService = {
  createStock,
  updateStock,
  upsertVariantStock,
  deleteVariantStock,
  getPaginatedVariantStock,
};
export default warehouseStockService;
