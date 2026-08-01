import prisma from "@/config/prisma";
import { User, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createEmployee = async (data: Prisma.UserUncheckedCreateInput) => {
  return prisma.user.create({ data });
};

const getEmployeeById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id, role: { isCustomer: false, isVendor: false } },
  });
};

const getPaginatedEmployees = async (
  filters: {
    search?: string;
  } & Partial<User>,
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

  const conditions: Prisma.UserWhereInput[] = [
    { role: { isCustomer: false, isVendor: false } },
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
    await prisma.user.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      include: { role: { select: { name: true } } }, // Include role name
      skip,
      take,
    }),
    await prisma.user.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateEmployee = async (
  id: string,
  data: Prisma.UserUncheckedUpdateInput,
) => {
  return prisma.user.update({ where: { id }, data });
};

const deleteEmployee = async (id: string) => {
  return prisma.user.delete({ where: { id } });
};

const employeeService = {
  createEmployee,
  getEmployeeById,
  getPaginatedEmployees,
  updateEmployee,
  deleteEmployee,
};
export default employeeService;
