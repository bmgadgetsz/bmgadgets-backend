import prisma from "@/config/prisma";
import { Category, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

/**
 * Create a single category
 * @param data - category data
 * @returns newly created category
 */
const createCategory = async (data: Category) => {
  // prisma query to create a new category
  return prisma.category.create({ data });
};

/**
 * Create multiple categories in bulk
 * @param data - array of categories to be created
 * @returns result of bulk insertion (count of inserted records)
 */
const createManyCategories = async (data: Category[]) => {
  // prisma query to create many categories at once
  return prisma.category.createMany({ data });
};

/**
 * Get a category by its ID
 * @param id - id of the category
 * @returns the category if found, otherwise null
 */
const getCategoryById = async (id: string) => {
  // prisma query to find a unique category using its id
  return prisma.category.findUnique({ where: { id } });
};
/**
 * Get paginated categories with optional filters and search
 * @param filters - query parameters like search, active, admin, or getAll
 * @param options - pagination and sorting options
 * @returns paginated list of categories along with metadata
 */
const getPaginatedCategories = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
    getAll?: string;
  } & Partial<Category>,
  options: PaginationOptions,
) => {
  // extract pagination and sorting values
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // destructure filter values separately
  const { search, isAdmin, active, getAll, ...filterData } = filters;

  // array to collect dynamic where conditions
  const conditions: Prisma.CategoryWhereInput[] = [];

  // partial text search on category name (case-insensitive)
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

  // filter categories based on active flag or restrict non-admins to active only
  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ active: true });
  }

  // exact match conditions for other provided filters
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  // merge conditions into a final Prisma where clause
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // parallel query to fetch list of categories and total count
  const [result, total] = await Promise.all([
    await prisma.category.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      // if getAll is true, return all categories without pagination
      ...(getAll === "true" ? {} : { skip, take }),
    }),
    await prisma.category.count({ where: whereConditions }),
  ]);
  // return formatted response with metadata
  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

/**
 * Update a category by its ID
 * @param id - id of the category to update
 * @param data - fields to be updated (partial category data)
 * @returns the updated category
 */
const updateCategory = async (id: string, data: Partial<Category>) => {
  // prisma query to update a specific category using its id
  return prisma.category.update({ where: { id }, data });
};

/**
 * Delete a category by its ID
 * @param id - id of the category to be deleted
 * @returns the deleted category record
 */
const deleteCategory = async (id: string) => {
  // prisma query to delete a category by id
  return prisma.category.delete({ where: { id } });
};

const categoryService = {
  createCategory,
  createManyCategories,
  getCategoryById,
  getPaginatedCategories,
  updateCategory,
  deleteCategory,
};
export default categoryService;
