import prisma from "@/config/prisma";
import { Prisma } from "@/generated/prisma";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";

/**
 * Get all notifications according to the filters
 * @param filters - query param filters
 * @param options - pagination options
 * @returns all notifications
 */
const getPaginatedNotifications = async (
  filters: { search?: string; isRead?: string } & Partial<Notification>,
  options: PaginationOptions,
) => {
  // Take the pagination options
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  // Get the filters
  const { search, isRead, ...filterData } = filters;
  const conditions: Prisma.NotificationWhereInput[] = [];

  // partial match
  if (search) {
    conditions.push({
      OR: ["title", "message"].map((field) => ({
        [field]: {
          contains: search,
          mode: "insensitive",
        },
      })),
    });
  }
  // flag to get all read notifications
  if (isRead) {
    conditions.push({ isRead: isRead === "true" });
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

  // where conditions object
  const whereConditions = conditions.length ? { AND: conditions } : {};

  // get data
  const [result, total, unread] = await Promise.all([
    await prisma.notification.findMany({
      where: whereConditions,
      orderBy: [{ [sortBy]: sortOrder }, { id: "desc" }],
      skip,
      take,
    }),
    await prisma.notification.count({
      where: whereConditions,
    }),
    await prisma.notification.findFirst({
      where: { ...whereConditions, isRead: false },
    }),
  ]);

  return {
    meta: { total, page, limit: take, unread: !!unread },
    data: result,
  };
};

/**
 * Updates a notification by its id
 * @param id - id of the notification
 * @param data - data that needs to be updated
 * @returns returns the updated notification
 */
const updateNotification = async (id: string, data: Partial<Notification>) => {
  return prisma.notification.update({
    where: { id },
    data,
  });
};

/**
 * Creates a new notification
 * @param data - content of the notification
 * @returns newly created notification
 */
const createNotification = async (
  data: Prisma.NotificationUncheckedCreateInput,
) => {
  return prisma.notification.create({
    data,
  });
};

/**
 * Get a notification by its id
 * @param id - notification id
 * @returns notification record if it exists
 */
const getNotificationById = async (id: string) => {
  return prisma.notification.findUnique({ where: { id } });
};

const notificationService = {
  getPaginatedNotifications,
  updateNotification,
  createNotification,
  getNotificationById,
};
export default notificationService;
