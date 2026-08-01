import message91Templates from "@/config/message91Templates";
import prisma from "@/config/prisma";
import razorpayInstance from "@/config/razorpay";
import { CartItem, Gender, Prisma, User } from "@/generated/prisma";
import { sendMail } from "@/services/transporter.service";
import ApiError from "@/utils/ApiError";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import sendSms from "@/utils/sendSms";
import {
  formatMMDDYYYY,
  getPeriodRange,
  getPreviousPeriodRange,
  percentChange,
  Period,
} from "@/utils/userStats";
import { randomUUID } from "crypto";
import { status as httpStatus } from "http-status";
import { z } from "zod";

const createUser = async (payload: Prisma.UserCreateInput) => {
  return prisma.user.create({
    data: payload,
  });
};
type FlatWishlistItem = {
  id: string; // wishlistItem id
  type: "VARIANT" | "COMBO";
  itemId: string; // productVariantId or productComboId
  title: string; // product/combo name
  imageUrl: string | null; // product thumbnail or combo image
  productId: string | null; // owning product (combos: parent product)
  categoryId: string | null; // derived from variant -> subCategory
  productName: string | null; // owning product name (combos: parent product name)
  itemName: string; // only for VARIANT
  price: number | null; // latest active price
  priceId: string | null; // latest active price id
  discountPercentage: number | null; // discount percentage if available
  quantity?: number; // quantity in cart, optional for wishlist
};

const updateUser = async (
  id: string,
  payload: Prisma.UserUncheckedUpdateInput & {
    addresses?: Prisma.AddressUncheckedCreateInput[];
    gender?: Gender;
    age?: number;
  },
) => {
  const { addresses, gender, age, ...data } = payload;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data,
      include: { role: true, customerProfile: true },
    });

    if (user.role.isCustomer) {
      const profile = await tx.customerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: { gender, age },
      });

      if (addresses?.length) {
        await tx.address.deleteMany({
          where: { customerProfileId: profile.id },
        });
        await tx.address.createMany({
          data: addresses.map((address) => ({
            ...address,
            customerProfileId: profile.id,
          })),
        });
      }
    }
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id },
  });
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: id },
    include: { addresses: { where: { active: true, primary: true }, take: 1 } },
  });

  const { data: safeEmail } = z.string().email().safeParse(updatedUser?.email);
  if (data.phone) {
    if (safeEmail)
      await sendMail(
        safeEmail,
        "BMGadgets Account Updated",
        `Your BMGadgets account has been updated with a new phone number ${updatedUser?.phone}.`,
      );
    sendSms(
      message91Templates.phoneNumberUpdatedNotification,
      data.phone as string,
      {
        Number: data.phone as string,
      },
    );
  }

  return { ...updatedUser, customerProfile: { ...profile, gender, age } };
};

const deleteUser = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { customerProfile: { userId: id } },
      data: {
        address: `REDACTED-${randomUUID()}`,
      },
    });
    return tx.user.update({
      where: { id },
      data: {
        active: false,
        phone: `REDACTED-${randomUUID()}`,
        email: `REDACTED-${randomUUID()}`,
      },
    });
  });
};

const getCartItems = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Customer profile is not updated",
    );
  }

  const cart = await prisma.cartItem.findMany({
    where: {
      customerProfileId: user.customerProfile.id,
    },
    include: {
      productVariant: {
        select: {
          variant: {
            select: {
              name: true,
              subCategory: { select: { categoryId: true } },
            },
          },
          product: {
            select: { id: true, name: true, thumbnailImageUrl: true },
          },
          prices: {
            select: { price: true, id: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { active: true },
          },
          discountPercentage: true,
        },
      },
      productCombo: {
        select: {
          name: true,
          imageUrl: true,
          prices: {
            select: { price: true, id: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { active: true },
          },
          product: {
            select: {
              id: true,
              name: true,
              varients: {
                select: {
                  variant: {
                    select: { subCategory: { select: { categoryId: true } } },
                  },
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const flat: FlatWishlistItem[] = cart.map((c) => {
    if (c.productVariant) {
      const pv = c.productVariant;
      const latest = pv.prices?.[0] ?? null;
      return {
        id: c.id,
        type: "VARIANT",
        itemId: c.productVariantId!,
        title: pv.product.name,
        imageUrl: pv.product.thumbnailImageUrl ?? null,
        productId: pv.product.id,
        productName: pv.product.name,
        categoryId: pv.variant?.subCategory?.categoryId ?? null,
        itemName: pv.variant.name,
        price: latest?.price ?? null,
        discountPercentage: pv.discountPercentage,
        priceId: latest?.id ?? null,
        quantity: c.quantity,
      };
    }

    // COMBO
    const pc = c.productCombo!;
    const latest = pc.prices?.[0] ?? null;
    const derivedCategoryId =
      pc.product?.varients?.[0]?.variant?.subCategory?.categoryId ?? null;

    return {
      id: c.id,
      type: "COMBO",
      itemId: c.productComboId!,
      title: pc.name,
      imageUrl: pc.imageUrl ?? null,
      productId: pc.product?.id ?? null,
      productName: pc.product?.name ?? null,
      itemName: pc.name,
      categoryId: derivedCategoryId,
      discountPercentage: 0,
      price: latest?.price ?? null,
      priceId: latest?.id ?? null,
      quantity: c.quantity,
    };
  });

  return flat;
};

const addCartItem = async (userId: string, payload: CartItem) => {
  const { quantity, ...data } = payload;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Customer profile is not updated",
    );
  }

  if (data.productVariantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.productVariantId },
    });
    if (!variant)
      throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  } else if (data.productComboId) {
    const combo = await prisma.productCombo.findUnique({
      where: { id: data.productComboId },
    });
    if (!combo)
      throw new ApiError(httpStatus.NOT_FOUND, "Product combo not found");
  }

  const exists = await prisma.cartItem.findFirst({
    where: {
      customerProfileId: user.customerProfile.id,
      ...(data.productVariantId
        ? { productVariantId: data.productVariantId }
        : { productComboId: data.productComboId }),
    },
  });
  if (exists) {
    return prisma.cartItem.update({
      where: {
        id: exists.id,
      },
      data: { quantity: Math.min(quantity, 6) },
    });
  }

  return prisma.cartItem.create({
    data: {
      customerProfileId: user.customerProfile.id,
      quantity: Math.min(quantity, 6) ?? 1,
      productVariantId: data.productVariantId,
      productComboId: data.productComboId,
    },
  });
};

const removeCartItem = async (userId: string, targetId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Customer profile is not updated",
    );
  }

  const cart = await prisma.cartItem.findFirst({
    where: {
      OR: [
        {
          customerProfileId: user.customerProfile.id,
          productVariantId: targetId,
        },
        {
          customerProfileId: user.customerProfile.id,
          productComboId: targetId,
        },
      ],
    },
  });

  if (cart?.customerProfileId !== user.customerProfile.id)
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized access");

  return prisma.cartItem.deleteMany({
    where: {
      OR: [
        {
          customerProfileId: user.customerProfile.id,
          productVariantId: targetId,
        },
        {
          customerProfileId: user.customerProfile.id,
          productComboId: targetId,
        },
      ],
    },
  });
};

const updateCartItemQuantity = async (
  userId: string,
  targetId: string,
  quantity: number,
) => {
  // eslint-disable-next-line no-param-reassign
  quantity = Math.min(quantity, 6);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Customer profile is not updated",
    );
  }

  const cartItem = await prisma.cartItem.findFirst({
    where: {
      OR: [
        {
          customerProfileId: user.customerProfile.id,
          productVariantId: targetId,
        },
        {
          customerProfileId: user.customerProfile.id,
          productComboId: targetId,
        },
      ],
    },
  });

  if (cartItem?.customerProfileId !== user.customerProfile.id)
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized access");

  return prisma.cartItem.update({
    where: {
      id: cartItem.id,
    },
    data: { quantity },
  });
};

// Wishlist
const addItemToWishList = async (
  userId: string,
  data: { productVariantId?: string; productComboId?: string },
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Could not sync wishlist, please complete your customer profile first",
    );
  }

  if (data.productVariantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.productVariantId },
    });
    if (!variant)
      throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  } else if (data.productComboId) {
    const combo = await prisma.productCombo.findUnique({
      where: { id: data.productComboId },
    });
    if (!combo)
      throw new ApiError(httpStatus.NOT_FOUND, "Product combo not found");
  }

  const exists = await prisma.wishlistItem.findFirst({
    where: {
      customerProfileId: user.customerProfile.id,
      ...(data.productVariantId
        ? { productVariantId: data.productVariantId }
        : { productComboId: data.productComboId }),
    },
  });
  if (exists) return exists;

  return prisma.wishlistItem.create({
    data: { ...data, customerProfileId: user.customerProfile.id },
  });
};

const removeItemFromWishList = async (userId: string, targetId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Could not sync wishlist, please complete your customer profile first",
    );
  }

  const wishList = await prisma.wishlistItem.findFirst({
    where: {
      OR: [
        {
          customerProfileId: user.customerProfile.id,
          productVariantId: targetId,
        },
        {
          customerProfileId: user.customerProfile.id,
          productComboId: targetId,
        },
      ],
    },
  });

  if (wishList?.customerProfileId !== user.customerProfile.id) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized access");
  }

  return prisma.wishlistItem.deleteMany({
    where: {
      OR: [
        {
          customerProfileId: user.customerProfile.id,
          productVariantId: targetId,
        },
        {
          customerProfileId: user.customerProfile.id,
          productComboId: targetId,
        },
      ],
    },
  });
};

const getWishListItems = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.customerProfile) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Customer profile is not updated",
    );
  }

  const wishlist = await prisma.wishlistItem.findMany({
    where: { customerProfileId: user.customerProfile.id },
    include: {
      productVariant: {
        select: {
          variant: {
            select: {
              name: true,
              subCategory: { select: { categoryId: true } },
            },
          },
          product: {
            select: { id: true, name: true, thumbnailImageUrl: true },
          },
          prices: {
            select: { price: true, id: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { active: true },
          },
          discountPercentage: true,
        },
      },
      productCombo: {
        select: {
          name: true,
          imageUrl: true,
          prices: {
            select: { price: true, id: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { active: true },
          },
          product: {
            select: {
              id: true,
              name: true,
              varients: {
                select: {
                  variant: {
                    select: { subCategory: { select: { categoryId: true } } },
                  },
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const flat: FlatWishlistItem[] = wishlist.map((w) => {
    if (w.productVariant) {
      const pv = w.productVariant;
      const latest = pv.prices?.[0] ?? null;
      return {
        id: w.id,
        type: "VARIANT",
        itemId: w.productVariantId!,
        title: pv.product.name,
        imageUrl: pv.product.thumbnailImageUrl ?? null,
        productId: pv.product.id,
        productName: pv.product.name,
        categoryId: pv.variant?.subCategory?.categoryId ?? null,
        itemName: pv.variant.name,
        price: latest?.price ?? null,
        discountPercentage: pv.discountPercentage,
        priceId: latest?.id ?? null,
      };
    }

    // COMBO
    const pc = w.productCombo!;
    const latest = pc.prices?.[0] ?? null;
    const derivedCategoryId =
      pc.product?.varients?.[0]?.variant?.subCategory?.categoryId ?? null;

    return {
      id: w.id,
      type: "COMBO",
      itemId: w.productComboId!,
      title: pc.name,
      imageUrl: pc.imageUrl ?? null,
      productId: pc.product?.id ?? null,
      productName: pc.product?.name ?? null,
      itemName: pc.name,
      categoryId: derivedCategoryId,
      discountPercentage: 0,
      price: latest?.price ?? null,
      priceId: latest?.id ?? null,
    };
  });

  return flat;
};

const getPaginatedUsers = async (
  filters: {
    search?: string;
    isAdmin?: string;
    active?: string;
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
  const { search, isAdmin, active, ...filterData } = filters;

  const conditions: Prisma.UserWhereInput[] = [{ active: true }];

  // partial match
  if (search) {
    conditions.push({
      OR: ["name", "email", "phone"].map((field) => ({
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

  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  } else if (!isAdmin || isAdmin === "false") {
    conditions.push({ active: true });
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.user.findMany({
      where: whereConditions,
      include: {
        customerProfile: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
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

const getAddressByCustomerProfileId = async (customerProfileId: string) => {
  return prisma.address.findMany({
    where: { customerProfileId, active: true },
    orderBy: { primary: "desc" }, // Primary address first
  });
};

const createAddress = async (
  data: Prisma.AddressUncheckedCreateInput & { userId: string },
) => {
  const { userId, ...rest } = data;

  let customerProfile = await prisma.customerProfile.findUnique({
    where: { userId },
    include: { addresses: { where: { active: true, primary: true }, take: 1 } },
  });

  return prisma.$transaction(async (tx) => {
    if (!customerProfile) {
      customerProfile = await tx.customerProfile.create({
        data: { userId },
        include: { addresses: true },
      });
    }

    const existingAddresses = await tx.address.findMany({
      where: { customerProfileId: customerProfile.id, active: true },
    });
    if (existingAddresses.length < 1) rest.primary = true;
    if (customerProfile.addresses.length > 0) rest.primary = false;

    if (data.primary)
      await tx.address.updateMany({
        where: { customerProfileId: customerProfile.id },
        data: { primary: false },
      });

    return tx.address.create({
      data: { ...rest, customerProfileId: customerProfile.id },
    });
  });
};

const updateAddress = async (
  id: string,
  customerProfileId: string,
  data: Prisma.AddressUncheckedUpdateInput,
) => {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address) throw new ApiError(httpStatus.NOT_FOUND, "Address not found");

  // eslint-disable-next-line no-param-reassign
  if (data.active === false) data.primary = false;

  return prisma.$transaction(async (tx) => {
    if (data.primary) {
      await tx.address.updateMany({
        where: { customerProfileId },
        data: { primary: false },
      });
    }
    if (data.active === false && address.primary)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot delete primary address",
      );

    return tx.address.update({
      where: { id },
      data,
    });
  });
};

const getAddressById = async (id: string) => {
  return prisma.address.findUnique({
    where: { id },
    include: { customerProfile: true },
  });
};

const topupWallet = async (userId: string, amount: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { customerProfile: true, role: true },
  });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (!user.role.isCustomer || !user.customerProfile)
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only customers can topup wallet",
    );

  const rpOrder = await razorpayInstance.orders.create({
    amount: Math.ceil(amount * 100),
    currency: "INR",
  });
  await prisma.walletLogs.create({
    data: {
      customerProfileId: user.customerProfile.id,
      amount,
      razorpayOrderId: rpOrder.id,
      status: false,
      type: "CREDIT",
    },
  });

  return rpOrder;
};

const getPaginatedWalletLogs = async (
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

  const conditions: Prisma.WalletLogsWhereInput[] = [{ status: true }];

  // partial match
  if (search) {
    conditions.push({
      OR: ["razorpayOrderId"].map((field) => ({
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
    await prisma.walletLogs.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    await prisma.walletLogs.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result.map((log) => ({
      ...log,
      referenceId: log.razorpayPaymentId || log.orderId,
    })),
  };
};

type DashboardStats = {
  totalRegistered: number;
  activeUsers: number;
  blockedUsers: number;
  newThisPeriod: number;
  newThisPeriodChangePercent: number | null;
  activeInPeriod?: number;
  activeInPeriodChangePercent?: number | null;
  period: Period;
  periodRange: { start: string; end: string };
};

const getUserStats = async (
  period: Period = "Weekly",
): Promise<DashboardStats> => {
  const totalRegisteredPromise = prisma.user.count();
  const activeUsersPromise = prisma.user.count({ where: { active: true } });
  const blockedUsersPromise = prisma.user.count({ where: { active: false } });

  const { start, end } = getPeriodRange(period);
  const { start: prevStart, end: prevEnd } = getPreviousPeriodRange(period);

  const currentNewUsersPromise = prisma.user.count({
    where: { createdAt: { gte: start, lte: end } },
  });

  const previousNewUsersPromise = prisma.user.count({
    where: { createdAt: { gte: prevStart, lte: prevEnd } },
  });

  // Example: active users created in period vs previous period (optional)
  const currentActiveInPeriodPromise = prisma.user.count({
    where: { active: true, createdAt: { gte: start, lte: end } },
  });
  const previousActiveInPeriodPromise = prisma.user.count({
    where: { active: true, createdAt: { gte: prevStart, lte: prevEnd } },
  });

  const [
    totalRegistered,
    activeUsers,
    blockedUsers,
    currentNewUsers,
    previousNewUsers,
    currentActiveInPeriod,
    previousActiveInPeriod,
  ] = await Promise.all([
    totalRegisteredPromise,
    activeUsersPromise,
    blockedUsersPromise,
    currentNewUsersPromise,
    previousNewUsersPromise,
    currentActiveInPeriodPromise,
    previousActiveInPeriodPromise,
  ]);

  const newPct = percentChange(currentNewUsers, previousNewUsers);
  const activePct = percentChange(
    currentActiveInPeriod,
    previousActiveInPeriod,
  );

  return {
    totalRegistered,
    activeUsers,
    blockedUsers,
    newThisPeriod: currentNewUsers,
    newThisPeriodChangePercent:
      newPct === null ? null : Math.round(newPct * 10) / 10,
    activeInPeriod: currentActiveInPeriod,
    activeInPeriodChangePercent:
      activePct === null ? null : Math.round(activePct * 10) / 10,
    period,
    periodRange: { start: start.toISOString(), end: end.toISOString() },
  };
};

/**
 * recent users for the table. Includes optional primary address location if present.
 */
const getRecentUsers = async (limit = 4) => {
  // include customer profile -> addresses (primary) if you store address there
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      active: true,
      customerProfile: {
        select: {
          addresses: {
            where: { primary: true },
            take: 1,
            select: {
              city: true,
              state: true,
              country: true,
            },
          },
        },
      },
    },
  });

  return users.map((u) => {
    const addr = u.customerProfile?.addresses?.[0];
    console.log("CUSTOMER ADDRESS : ", addr);
    const location = addr
      ? [addr.city, addr.state, addr.country].filter(Boolean).join(", ")
      : "Unknown";
    return {
      id: u.id,
      name: u.name ?? "—",
      email: u.email,
      location,
      joinDate: formatMMDDYYYY(u.createdAt),
      status: u.active ? "Active" : "Inactive",
    };
  });
};

const userService = {
  updateUser,
  deleteUser,
  addCartItem,
  removeCartItem,
  getCartItems,
  updateCartItemQuantity,
  addItemToWishList,
  removeItemFromWishList,
  getWishListItems,
  getPaginatedUsers,
  createUser,
  getAddressByCustomerProfileId,
  createAddress,
  updateAddress,
  getAddressById,
  topupWallet,
  getPaginatedWalletLogs,
  getUserStats,
  getRecentUsers,
};
export default userService;
