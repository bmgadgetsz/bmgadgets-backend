import prisma from "@/config/prisma";
import { Post, Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

const createPost = async (data: Post) => {
  return prisma.post.create({ data });
};

const getPostById = async (id: string) => {
  return prisma.post.findUnique({ where: { id } });
};

const getPaginatedPosts = async (
  filters: { search?: string } & Partial<Post>,
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

  const conditions: Prisma.PostWhereInput[] = [];

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
    await prisma.post.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.post.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updatePost = async (id: string, data: Partial<Post>) => {
  return prisma.post.update({ where: { id }, data });
};

const deletePost = async (id: string) => {
  return prisma.post.delete({ where: { id } });
};

const postService = {
  createPost,
  getPostById,
  getPaginatedPosts,
  updatePost,
  deletePost,
};
export default postService;
