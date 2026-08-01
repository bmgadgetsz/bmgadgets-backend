import prisma from "@/config/prisma";
import { Role, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createRole = async (data: Role) => {
  return prisma.role.create({ data });
};

const getRoleById = async (id: string) => {
  return prisma.role.findUnique({ where: { id } });
};

const getPaginatedRoles = async (
  filters: { search?: string } & Partial<Role>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, ...filterData } = filters;

  const conditions: Prisma.RoleWhereInput[] = [
    { isCustomer: false, isVendor: false },
  ];

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
    await prisma.role.findMany({
      where: whereConditions,
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.role.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateRole = async (id: string, data: Partial<Role>) => {
  if (data.isCustomer) {
    const existingCustomerRole = await prisma.role.findFirst({
      where: { isCustomer: true, id: { not: id } },
    });
    if (existingCustomerRole)
      throw new Error(
        "Customer role already exists. Only one customer role is allowed.",
      );
  }

  if (data.isVendor) {
    const existingVendorRole = await prisma.role.findFirst({
      where: { isVendor: true, id: { not: id } },
    });
    if (existingVendorRole)
      throw new Error(
        "Vendor role already exists. Only one vendor role is allowed.",
      );
  }

  return prisma.role.update({ where: { id }, data });
};

const deleteRole = async (id: string) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (role?.isCustomer || role?.isVendor)
    throw new Error("Cannot delete core system roles.");

  return prisma.role.delete({ where: { id } });
};

const roleService = {
  createRole,
  getRoleById,
  getPaginatedRoles,
  updateRole,
  deleteRole,
};
export default roleService;
