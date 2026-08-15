import env from "@/config/env";
import prisma from "@/config/prisma";
import razorpayInstance from "@/config/razorpay";
import {
  Order,
  PaymentType,
  Prisma,
  Shipment,
  Warehouse,
} from "@/generated/prisma";
import ensureOrderFulfillableBySingleWarehouse from "@/services/shipway/eligibility";
import enqueuePushOrder from "@/services/shipway/queueWorker";
import shipwayService from "@/services/shipway/shipway.service";
import { sendMail } from "@/services/transporter.service";
import ApiError from "@/utils/ApiError";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { status as httpStatus } from "http-status";
import { Orders } from "razorpay/dist/types/orders";
import { z } from "zod";
import { getIO } from "@/config/socket";
import sendSms from "@/utils/sendSms";
import message91Templates from "@/config/message91Templates";
import { orderShippedTemplate } from "@/template/email/Shipping";
import sendEmail from "@/utils/mail";
import orderTemplate from "./order.template";

const calculateCart = async (
  customerProfileId: string,
  couponCode?: string,
) => {
  // Fetch the users cart, if no cart found: return default values
  const cart = await prisma.cartItem.findMany({
    where: { customerProfileId },
    include: {
      productVariant: {
        include: {
          warehouseStocks: true,
          product: { include: { hsn: true } },
          variant: {
            select: {
              name: true,
              subCategory: { select: { categoryId: true } },
            },
          },
          prices: {
            where: { active: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      productCombo: {
        include: {
          warehouseStocks: true,
          product: {
            include: {
              hsn: true,
              varients: {
                take: 1,
                select: {
                  variant: {
                    select: { subCategory: { select: { categoryId: true } } },
                  },
                },
              },
            },
          },
          prices: {
            where: { active: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  // Calculate subtotal (including discounted prices provided at product level)
  const subTotal = cart.reduce((acc, curr) => {
    const productVariantPrice = curr.productVariant?.prices[0].price
      ? curr.productVariant.prices[0].price -
        (curr.productVariant.prices[0].price *
          (curr.productVariant.discountPercentage ?? 0)) /
          100
      : 0;
    const productVariantQuantity = curr.quantity ?? 0;

    const productComboPrice = curr.productCombo?.prices[0].price ?? 0;
    const productComboQuantity = curr.quantity ?? 0;

    return (
      acc +
      productVariantPrice * productVariantQuantity +
      productComboPrice * productComboQuantity
    );
  }, 0);
  // Calculate shipping cost
  let shippingCost = 0;
  let isFirstOrder = false;
  const companyInfo = await prisma.companyInfo.findFirst();
  if (companyInfo) {
    const firstOrder = await prisma.order.findFirst({
      where: { createdById: customerProfileId },
    });

    if (companyInfo.firstOrderFreeShipping && !firstOrder) {
      // Rule 1 & 4: First order always free, regardless of subtotal
      shippingCost = 0;
      isFirstOrder = true;
    } else if (
      subTotal <= companyInfo.shippingCostThreshold ||
      !companyInfo.thresholdActive
    ) {
      // Rule 2: Below threshold → charge standard
      shippingCost = companyInfo.standardShippingCost;
    } else {
      // Rule 3: Above threshold → free
      shippingCost = 0;
    }
  }

  if (!cart.length)
    return {
      items: cart.length,
      subTotal: 0,
      gst: 0,
      couponDiscount: 0,
      grandTotal: 0,
      applyCoupon: false,
      coupon: undefined,
      cart,
      shippingCost: 0,
      isFirstOrder,
    };

  // Prices posted are tax-inclusive (no extra GST added on top of item prices)
  const gst = 0;

  // Fetch coupon record from DB
  const coupon = couponCode
    ? await prisma.coupon.findUnique({
        where: { code: couponCode, active: true },
        include: {
          usedIn: { select: { createdById: true } },
          applicableFor: true,
        },
      })
    : null;
  if (couponCode && !coupon)
    throw new ApiError(httpStatus.NOT_FOUND, "Coupon not found");
  let applyCoupon = false;
  let couponDiscount = 0;

  if (coupon) {
    // If the coupon has a usage limit and the limit is exhausted: throw error and exit
    if (coupon.usageLimit !== null && coupon.usageLimit <= 0)
      throw new ApiError(httpStatus.BAD_REQUEST, "Coupon limit exhausted");
    // If the coupon is already used by the customer: throw error and exit
    else if (coupon.usedIn.some((u) => u.createdById === customerProfileId))
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Coupon already used by the customer",
      );
    // If the coupon is category specific and the cart does not have any applicable category: throw error and exit
    else if (coupon.applicableFor.length) {
      // List of all unique categories present in the cart
      const cartCategoryIds = [
        ...new Set(
          cart
            .flatMap((item) => {
              return [
                item.productVariant?.variant.subCategory.categoryId,
                item.productCombo?.product.varients[0]?.variant.subCategory
                  .categoryId,
              ];
            })
            .filter((i) => i !== undefined),
        ),
      ];
      if (
        !coupon.applicableFor.find((af) =>
          cartCategoryIds.includes(af.categoryId),
        )
      )
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Coupon not applicable for the cart items",
        );
    }
    // If the subtotal is less than the minimum order amount required for the coupon: throw error and exit
    else if (coupon.minimumOrderAmount > subTotal)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cart subtotal must be at least ₹${coupon.minimumOrderAmount} to apply this coupon`,
      );
    // If the subtotal is more than the maximum order amount required for the coupon: throw error and exit
    else if (coupon.maximumOrderAmount < subTotal)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cart subtotal must be less than ₹${coupon.maximumOrderAmount} to apply this coupon`,
      );
    // If the coupon is not valid for the current date: throw error and exit
    else if (
      new Date() < new Date(coupon.validFrom) ||
      new Date() > new Date(coupon.validTo)
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Coupon is not valid for the current date",
      );
    // If everything is fine: apply the coupon
    else applyCoupon = true;

    if (applyCoupon) {
      // Calculate coupon amount, for percentage, apply it on the subtotal
      couponDiscount =
        coupon.flatDiscount ?? subTotal * (coupon.percentageDiscount! / 100);

      // If the coupon is category and percentage based, overwrite the coupon amount calculation based on only applicable items
      if (coupon.applicableFor.length && !coupon.flatDiscount) {
        const applicableItems = cart.filter((item) => {
          const categoryId =
            item.productVariant?.variant.subCategory.categoryId ??
            item.productCombo?.product.varients[0]?.variant.subCategory
              .categoryId ??
            "";

          return coupon.applicableFor.some(
            (af) => af.categoryId === categoryId,
          );
        });

        const applicableItemsSubTotal = applicableItems.reduce((acc, curr) => {
          const productVariantPrice = curr.productVariant?.prices[0].price
            ? curr.productVariant.prices[0].price -
              (curr.productVariant.prices[0].price *
                (curr.productVariant.discountPercentage ?? 0)) /
                100
            : 0;
          const productVariantQuantity = curr.quantity ?? 0;

          const productComboPrice = curr.productCombo?.prices[0].price ?? 0;
          const productComboQuantity = curr.quantity ?? 0;

          return (
            acc +
            productVariantPrice * productVariantQuantity +
            productComboPrice * productComboQuantity
          );
        }, 0);

        // Overwrite coupon discount calculation for percentage
        couponDiscount =
          applicableItemsSubTotal * (coupon.percentageDiscount! / 100);
      }
    }
  }

  // Apply maximum discount cap if present
  couponDiscount = coupon?.maximumDiscountCap
    ? Math.min(couponDiscount, coupon?.maximumDiscountCap)
    : couponDiscount;

  return {
    items: cart.length,
    subTotal,
    gst,
    couponDiscount: couponDiscount ?? 0,
    grandTotal: subTotal - couponDiscount + shippingCost,
    applyCoupon,
    coupon,
    cart,
    shippingCost,
    isFirstOrder,
  };
};

interface CreateOrderInput {
  currentUser?: any;
  paymentType: PaymentType;
  couponCode?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  address?: {
    addressType?: "HOME" | "OFFICE" | "OTHER";
    address?: string;
    houseFlatNo?: string;
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    zipcode?: string;
  };
  items?: Array<{
    productVariantId?: string;
    productComboId?: string;
    quantity: number;
  }>;
}

const createOrder = async (params: CreateOrderInput) => {
  const { currentUser, paymentType, couponCode, customer, address: addressPayload, items } = params;
  let customerProfileId = currentUser?.customerProfile?.id;

  const rawName = customer?.name?.trim();
  const rawPhone = customer?.phone?.trim();
  const rawEmail = customer?.email?.trim().toLowerCase();

  if (!customerProfileId) {
    if (!rawName) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Receiver full name is required");
    }
    if (!rawPhone || rawPhone.length < 10) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Valid 10-digit phone number is required",
      );
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(rawEmail ? [{ email: rawEmail }] : []),
          { phone: rawPhone },
        ],
      },
      include: { customerProfile: true },
    });

    if (!user) {
      const role = await prisma.role.findFirst({ where: { isCustomer: true } });
      if (!role) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Customer role is not configured. Please contact support.",
        );
      }

      user = await prisma.user.create({
        data: {
          email: rawEmail || `guest_${Date.now()}@bmgadgets.com`,
          phone: rawPhone,
          name: rawName,
          roleId: role.id,
        },
        include: { customerProfile: true },
      });
    }

    if (!user.customerProfile) {
      const profile = await prisma.customerProfile.create({
        data: { userId: user.id },
      });
      customerProfileId = profile.id;
    } else {
      customerProfileId = user.customerProfile.id;
    }
  }

  const customerProfile = await prisma.customerProfile.findUnique({
    where: { id: customerProfileId },
    include: { user: true },
  });
  if (!customerProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, "Customer not found");
  }

  // Update associated user's name and phone if new details are provided in order form
  if (customerProfile.user) {
    const userUpdates: any = {};
    if (rawName && rawName !== customerProfile.user.name) {
      userUpdates.name = rawName;
    }
    if (
      rawPhone &&
      (customerProfile.user.phone.startsWith("PLACEHOLDER#") ||
        customerProfile.user.phone.startsWith("+9100000") ||
        customerProfile.user.phone !== rawPhone)
    ) {
      userUpdates.phone = rawPhone;
    }
    if (
      rawEmail &&
      (customerProfile.user.email.startsWith("guest_") ||
        customerProfile.user.email.startsWith("PLACEHOLDER#"))
    ) {
      userUpdates.email = rawEmail;
    }

    if (Object.keys(userUpdates).length > 0) {
      try {
        await prisma.user.update({
          where: { id: customerProfile.userId },
          data: userUpdates,
        });
      } catch (e) {
        delete userUpdates.phone;
        if (Object.keys(userUpdates).length > 0) {
          await prisma.user.update({
            where: { id: customerProfile.userId },
            data: userUpdates,
          }).catch(() => {});
        }
      }
    }
  }

  let address;
  if (addressPayload?.address || addressPayload?.zipcode) {
    address = await prisma.address.create({
      data: {
        addressType: (addressPayload.addressType as any) || "HOME",
        address: addressPayload.address || "Delivery Address",
        houseFlatNo: addressPayload.houseFlatNo || "N/A",
        road: addressPayload.road || "N/A",
        city: addressPayload.city || "City",
        state: addressPayload.state || "State",
        country: addressPayload.country || "India",
        zipcode: addressPayload.zipcode || "000000",
        source: "MANUAL",
        primary: true,
        customerProfileId,
      },
    });
  } else {
    address = await prisma.address.findFirst({
      where: { customerProfileId, primary: true },
    });
  }

  if (!address) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No delivery address provided or found for customer",
    );
  }

  if (Array.isArray(items) && items.length > 0) {
    await prisma.cartItem.deleteMany({ where: { customerProfileId } });
    for (const item of items) {
      if (item.productVariantId || item.productComboId) {
        await prisma.cartItem.create({
          data: {
            customerProfileId,
            quantity: item.quantity,
            productVariantId: item.productVariantId || null,
            productComboId: item.productComboId || null,
          },
        });
      }
    }
  }
  // INFO: Beyond this point, we have a valid user and a valid address

  // If COD: check if the address is serviceable (with 1.5s timeout & fallback)
  if (paymentType === "COD") {
    let availableCurriers: any = ["A"];
    if (env.app.nodeEnv !== "development" && env.shipway.base_url && env.shipway.base_url.startsWith("http")) {
      try {
        const timeoutPromise = new Promise<any>((resolve) => setTimeout(() => resolve(["DEFAULT"]), 1500));
        availableCurriers = await Promise.race([
          shipwayService.getPincodeServiceable(address.zipcode, "C"),
          timeoutPromise,
        ]);
        if (!Array.isArray(availableCurriers) || availableCurriers.length === 0) {
          availableCurriers = ["DEFAULT"];
        }
      } catch (e) {
        availableCurriers = ["DEFAULT"];
      }
    }
  }

  const cartBackup = [];
  // Fetch the cart and its associated values
  const {
    subTotal,
    couponDiscount,
    gst,
    applyCoupon,
    coupon,
    cart,
    shippingCost,
  } = await calculateCart(customerProfileId, couponCode);
  cartBackup.push(...cart);

  // Check if any item in the cart is OOS
  const outOfStock = cart.find((i) => {
    let totalStock = 0;
    if (i.productVariant)
      totalStock = i.productVariant?.warehouseStocks.reduce(
        (acc, curr) => acc + (curr.productCount ?? 0),
        0,
      );
    else if (i.productCombo)
      totalStock = i.productCombo?.warehouseStocks.reduce(
        (acc, curr) => acc + (curr.comboCount ?? 0),
        0,
      );

    return i.quantity > totalStock;
  });
  if (outOfStock) {
    const itemType = outOfStock.productVariant
      ? "productVariant"
      : "productCombo";
    const quantityInStock = outOfStock.productVariant
      ? outOfStock.productVariant?.warehouseStocks.reduce(
          (acc, curr) => acc + (curr.productCount ?? 0),
          0,
        )
      : outOfStock.productCombo?.warehouseStocks.reduce(
          (acc, curr) => acc + (curr.comboCount ?? 0),
          0,
        );
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Only ${quantityInStock} units of ${outOfStock[itemType]?.product.name} - ${outOfStock.productVariant?.variant.name ?? outOfStock.productCombo?.name} is available in stock, but your cart has ${outOfStock.quantity} units`,
    );
  }

  const finalAmount = subTotal - couponDiscount + shippingCost;
  let amountTobePaid = finalAmount;

  let rpOrder: Orders.RazorpayOrder | undefined;
  if (paymentType === "ONLINE") {
    if (customerProfile.wallet > 0) {
      if (customerProfile.wallet >= finalAmount) {
        // Wallet covers everything
        amountTobePaid = 0;
      } else {
        // Partial wallet + gateway
        amountTobePaid = finalAmount - customerProfile.wallet;
      }
    }

    // Initiate Razorpay order only if amount to be paid is more than 0
    if (amountTobePaid > 0) {
      rpOrder = await razorpayInstance.orders.create({
        amount: Math.ceil(amountTobePaid * 100),
        currency: "INR",
      });
    }
  }

  // Crate the order
  const order = await prisma.$transaction(
    async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          createdById: customerProfileId,
          razorpayOrderId: rpOrder ? rpOrder.id : null,
          addressId: address.id,
          // Save the coupon in a buffer for pending payments
          tempCouponId: applyCoupon ? coupon?.id : null,
          // For COD and fully wallet paid orders, save the coupon directly
          couponId:
            // eslint-disable-next-line no-nested-ternary
            amountTobePaid === 0 || paymentType === "COD"
              ? applyCoupon
                ? coupon?.id
                : null
              : null,
          subtotal: subTotal,
          gst,
          couponDiscount: couponDiscount ?? 0,
          shippingCost,
          paymentType,
          status:
            amountTobePaid === 0 || paymentType === "COD"
              ? "INITIALIZED"
              : "PENDING",
        },
        include: { createdBy: { include: { user: true } } },
      });

      if (!cart.length)
        throw new ApiError(httpStatus.BAD_REQUEST, "Cart is empty");
      await tx.orderItem.createMany({
        data: cart.map((item) => {
          const itemType = item.productVariant
            ? "PRODUCT_VARIANT"
            : "PRODUCT_COMBO";

          // eslint-disable-line
          return {
            orderId: newOrder.id,
            priceId:
              itemType === "PRODUCT_VARIANT"
                ? // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  item.productVariant?.prices[0].id!
                : // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  item.productCombo?.prices[0].id!,
            quantity: item.quantity,
          };
        }),
      });

      // Immediatly clear the cart and deduct from wallet if the order is COD or fully wallet paid
      if (amountTobePaid === 0 || paymentType === "COD") {
        const eligibility = await ensureOrderFulfillableBySingleWarehouse(
          newOrder.id,
          tx,
        );
        if (!eligibility.ok) {
          // eslint-disable-next-line no-console
          console.log("NOT ELIGIBLE : ", eligibility.message);
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Payment verified, but order cannot be fulfilled from a single warehouse",
          );
        }

        await tx.cartItem.deleteMany({
          where: { customerProfileId: newOrder.createdById },
        });

        const walletUsed =
          customerProfile.wallet >= finalAmount
            ? finalAmount
            : customerProfile.wallet;
        await tx.customerProfile.update({
          where: { id: customerProfileId },
          data: {
            wallet: { decrement: walletUsed },
            walletBufferForOnlinePayments: { decrement: walletUsed },
          },
        });
        await tx.walletLogs.create({
          data: {
            customerProfileId,
            amount: -walletUsed,
            type: "DEBIT",
            orderId: newOrder.id,
          },
        });
      }

      if (paymentType === "ONLINE" && customerProfile.wallet > 0) {
        const walletUsed =
          customerProfile.wallet >= finalAmount
            ? finalAmount
            : customerProfile.wallet;

        // Save the wallet amount in a buffer, will be deducted upon payment success webhook
        if (walletUsed > 0) {
          await tx.customerProfile.update({
            where: { id: customerProfileId },
            data: { walletBufferForOnlinePayments: walletUsed },
          });
        }
      }

      const { id: _id, ...orderData } = newOrder;
      return {
        ...orderData,
        mongoOrderId: newOrder.id,
        razorpayKeyId: env.razorpay.keyId,
        amountTobePaid,
      };
    },
    { timeout: 10_000 },
  );

  if (paymentType === "COD" || amountTobePaid === 0) {
    // // --- AFTER TX COMMIT: run pre-check for fulfillability

    enqueuePushOrder(order.mongoOrderId).catch(async (err) => {
      // eslint-disable-next-line
      console.error("enqueuePushOrder failed (async)", err);
    });
  }

  if (amountTobePaid === 0 || paymentType === "COD") {
    // WARN: Secondary: Sending order confirmation email
    const { data: safeEmail } = z
      .string()
      .email()
      .safeParse(order.createdBy.user.email);
    if (safeEmail)
      await sendMail(
        safeEmail,
        `Order Confirmation - #${order.mongoOrderId}`,
        orderTemplate.generateOrderConfirmationEmail(
          { ...order, id: order.mongoOrderId },
          // @ts-expect-error cart item price type mismatch
          cart,
          finalAmount,
        ),
      );
    await sendSms(
      message91Templates.orderConfirmation,
      order.createdBy.user.phone,
      {
        Name: order.createdBy.user.name!,
        Order_ID: order.mongoOrderId,
        Amount: finalAmount.toString(),
      },
    );
  } else if (paymentType === "ONLINE") {
    await sendSms(
      message91Templates.orderConfirmation,
      order.createdBy.user.phone,
      {
        OrderID: order.mongoOrderId,
      },
    );
  }

  // WARN: Secondary operation: Increament order count for all products in the order
  const productIds = cartBackup.map((item) => {
    const itemType = item.productVariant ? "productVariant" : "productCombo";
    return item[itemType]?.productId;
  }) as string[];
  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { orderCount: { increment: 1 } },
  });

  // WARN: Secondary: Notify all admins and order management employees about new order
  const employeesToBeNotified = await prisma.user.findMany({
    where: {
      OR: [
        { role: { isAdmin: true } },
        {
          role: {
            permissions: {
              some: {
                resource: "ORDER_MANAGEMENT",
                access: { hasSome: ["WRITE", "DELETE"] },
              },
            },
          },
        },
      ],
    },
  });
  await prisma.notification.createMany({
    data: employeesToBeNotified.map((e) => ({
      type: "ORDER_CREATED",
      title: `New order #${order.mongoOrderId} placed by ${order.createdBy.user.name}`,
      receiverId: e.id,
      orderId: order.mongoOrderId,
    })),
  });
  const io = getIO();
  employeesToBeNotified.forEach((vh) => {
    io.to(vh.id).emit("notification", {
      id: order.mongoOrderId,
    });
  });

  const vendorTobeNotified = await prisma.vendorProfile.findMany({
    where: {
      id: {
        in: cartBackup
          .map(
            (i) =>
              i.productVariant?.product.createdById ??
              i.productCombo?.product.createdById,
          )
          .filter(Boolean) as string[],
      },
    },
  });
  await prisma.notification.createMany({
    data: vendorTobeNotified.map((e) => ({
      type: "ORDER_CREATED",
      title: `New order ${order.mongoOrderId} received.`,
      receiverId: e.userId,
      orderId: order.mongoOrderId,
    })),
  });
  vendorTobeNotified.forEach((vh) => {
    io.to(vh.userId).emit("notification", {
      id: order.mongoOrderId,
    });
  });

  return rpOrder ?? order;
};

const getOrderById = async (id: string) => {
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
  if (!isMongoId || id.startsWith("order_")) {
    return prisma.order.findFirst({ where: { razorpayOrderId: id } });
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return prisma.order.findFirst({ where: { razorpayOrderId: id } });
  }
  return order;
};

const getPaginatedOrders = async (
  filters: {
    search?: string;
    vendorId?: string;
    withRefund?: string;
  } & Partial<Order>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, vendorId, withRefund, ...filterData } = filters;

  const conditions: Prisma.OrderWhereInput[] = [];

  // filter for vendor orders
  if (vendorId)
    conditions.push({
      items: {
        some: {
          price: {
            OR: [
              { productVariant: { product: { createdById: vendorId } } },
              { productCombo: { product: { createdById: vendorId } } },
            ],
          },
        },
      },
    });
  if (withRefund === "true")
    conditions.push({
      items: {
        some: {
          refundRequest: {
            status: {
              in: ["PENDING", "APPROVED", "REFUNDED", "REJECTED"],
            },
          },
        },
      },
    });

  const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

  // Search filter matching: support ObjectId, short Order ID, customer name/phone/email, tracking ID, or Razorpay Order ID
  if (search && search.trim()) {
    const queryStr = search.trim();
    if (isValidObjectId(queryStr)) {
      conditions.push({ id: { equals: queryStr } });
    } else {
      conditions.push({
        OR: [
          { id: { contains: queryStr, mode: "insensitive" } },
          { razorpayOrderId: { contains: queryStr, mode: "insensitive" } },
          { trackingId: { contains: queryStr, mode: "insensitive" } },
          {
            createdBy: {
              user: {
                OR: [
                  { name: { contains: queryStr, mode: "insensitive" } },
                  { email: { contains: queryStr, mode: "insensitive" } },
                  { phone: { contains: queryStr, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      });
    }
  }

  // Filter out empty string/null/undefined values from filterData
  const activeFilters: Record<string, any> = {};
  Object.keys(filterData).forEach((key) => {
    const val = (filterData as any)[key];
    if (val !== undefined && val !== null && val !== "") {
      activeFilters[key] = val;
    }
  });

  if (Object.keys(activeFilters).length > 0) {
    conditions.push({
      AND: Object.keys(activeFilters).map((key) => ({
        [key]: {
          equals: activeFilters[key],
        },
      })),
    });
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.order.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },

      include: {
        coupon: true,
        items: {
          where: vendorId
            ? {
                price: {
                  OR: [
                    { productVariant: { product: { createdById: vendorId } } },
                    { productCombo: { product: { createdById: vendorId } } },
                  ],
                },
              }
            : undefined,
          include: {
            price: {
              include: {
                productVariant: {
                  include: {
                    product: {
                      include: {
                        varients: {
                          where: { active: true },
                          take: 1,
                          include: {
                            variant: { include: { subCategory: true } },
                          },
                        },
                        hsn: true,
                      },
                    },
                    variant: { include: { subCategory: true } },
                    prices: {
                      where: { active: true },
                      take: 1,
                      orderBy: { createdAt: "desc" },
                    },
                  },
                },
                productCombo: {
                  include: {
                    product: {
                      include: {
                        hsn: true,
                        varients: {
                          where: { active: true },
                          take: 1,
                          include: {
                            variant: { include: { subCategory: true } },
                          },
                        },
                      },
                    },
                    prices: {
                      where: { active: true },
                      take: 1,
                      orderBy: { createdAt: "desc" },
                    },
                  },
                },
              },
            },
          },
        },
        createdBy: {
          include: {
            user: true,
          },
        },
        address: true,
      },
      skip,
      take,
    }),
    await prisma.order.count({ where: whereConditions }),
  ]);

  const allOrderItemIds = result.flatMap((order) =>
    order.items.map((item) => item.id),
  );

  const shipments = await prisma.shipment.findMany({
    where: {
      orderItemIds: {
        hasSome: allOrderItemIds,
      },
    },
    select: {
      id: true,
      orderItemIds: true,
      status: true,
    },
  });

  const shipmentMap: Record<string, typeof shipments> = {};

  for (const sh of shipments) {
    for (const itemId of sh.orderItemIds) {
      if (!shipmentMap[itemId]) shipmentMap[itemId] = [];
      shipmentMap[itemId].push(sh);
    }
  }

  return {
    meta: { total, page, limit: take },
    data: result.map((order) => {
      return {
        ...order,
        items: order.items.map((item) => {
          const itemType = item.price.productVariant
            ? "productVariant"
            : "productCombo";
          const shipmentsForItem = shipmentMap[item.id] ?? [];
          // isDelivered only if all shipments of this item are DELIVERED
          const isDelivered =
            shipmentsForItem.length > 0 &&
            shipmentsForItem.every((sh) => sh.status === "DELIVERED");

          return {
            orderItemId: item.id,
            isDelivered,
            itemType,
            quantity: item.quantity,
            coupon: order.coupon,
            createdBy: order.createdBy,
            address: order.address,
            productId: item.price[itemType]?.product.id,
            categoryId:
              item.price[itemType]?.product.varients[0]?.variant.subCategory
                .categoryId,
            productName: item.price[itemType]?.product.name,
            productThumbnailUrl:
              item.price[itemType]?.product.thumbnailImageUrl,
            variantName: item.price.productVariant?.variant.name,
            comboName: item.price.productCombo?.name,
            price:
              item.price.price -
              (item.price.price *
                (item.price.productVariant?.discountPercentage ?? 0)) /
                100,
            hsn: item.price[itemType]?.product.hsn,
          };
        }),
      };
    }),
  };
};

const updateOrder = async (id: string, data: any) => {
  const oldOrder = await prisma.order.findUnique({
    where: { id },
    include: { createdBy: { include: { user: true } }, address: true },
  });

  const updatePayload: any = { ...data };

  if (
    data.expectedDeliveryDate &&
    typeof data.expectedDeliveryDate === "string"
  ) {
    updatePayload.expectedDeliveryDate = new Date(data.expectedDeliveryDate);
  }
  if (data.status === "SHIPPED" && !data.shippedAt) {
    updatePayload.shippedAt = new Date();
  }
  if (data.status === "DELIVERED" && !data.deliveredAt) {
    updatePayload.deliveredAt = new Date();
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: updatePayload,
    include: { createdBy: { include: { user: true } }, address: true },
  });

  // Check if manual dispatch or shipping notification should be sent
  const isDispatching =
    (data.status === "SHIPPED" && oldOrder?.status !== "SHIPPED") ||
    (data.fulfillmentMode === "MANUAL" && (data.trackingId || data.deliveryPartner)) ||
    (data.trackingId && data.trackingId !== oldOrder?.trackingId);

  if (isDispatching && updatedOrder.createdBy?.user) {
    const phone = updatedOrder.createdBy.user.phone;
    const name = updatedOrder.createdBy.user.name || "Customer";
    const partner = updatedOrder.deliveryPartner || "Courier";
    const trackId = updatedOrder.trackingId || "N/A";
    const trackUrl =
      updatedOrder.trackingUrl ||
      `https://bmgadgetsz.in/orders/${updatedOrder.id}/track`;

    if (phone && !phone.startsWith("PLACEHOLDER#")) {
      await sendSms(
        message91Templates.orderShippedNotification,
        phone,
        {
          Order_ID: updatedOrder.id,
          Name: name,
          Tracking_ID: `${partner} - ${trackId}`,
          Tracking_link: trackUrl,
        },
      ).catch((err) =>
        // eslint-disable-next-line no-console
        console.error("[Manual Dispatch SMS/WhatsApp Error]:", err),
      );
    }

    const email = updatedOrder.createdBy.user.email;
    if (
      email &&
      !email.startsWith("guest_") &&
      !email.startsWith("PLACEHOLDER#")
    ) {
      const tpl = orderShippedTemplate({
        firstName: name,
        orderId: updatedOrder.id,
        awb: trackId,
        courier: partner,
        estimatedDelivery: updatedOrder.expectedDeliveryDate?.toISOString() || null,
        trackUrl,
      });
      await sendEmail(email, tpl.subject, tpl.html).catch((err) =>
        // eslint-disable-next-line no-console
        console.error("[Manual Dispatch Email Error]:", err),
      );
    }
  }

  const isDelivered =
    data.status === "DELIVERED" && oldOrder?.status !== "DELIVERED";

  if (isDelivered && updatedOrder.createdBy?.user) {
    const phone = updatedOrder.createdBy.user.phone;
    const name = updatedOrder.createdBy.user.name || "Customer";

    if (phone && !phone.startsWith("PLACEHOLDER#")) {
      await sendSms(
        message91Templates.deliveryConfirmationNotification,
        phone,
        {
          Name: name,
          Order_ID: updatedOrder.id,
        },
      ).catch((err) =>
        // eslint-disable-next-line no-console
        console.error("[Delivery SMS/WhatsApp Error]:", err),
      );
    }
  }

  return updatedOrder;
};

const deleteOrder = async (id: string) => {
  return prisma.order.delete({ where: { id } });
};

const reorder = async (id: string) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          price: {
            include: {
              productCombo: {
                include: {
                  prices: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    where: { active: true },
                  },
                },
              },
              productVariant: {
                include: {
                  prices: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    where: { active: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");

  const { items } = order;

  return prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({
      where: { customerProfileId: order.createdById },
    });

    return tx.cartItem.createMany({
      data: items.map((i) => ({
        customerProfileId: order.createdById,
        productVariantId: i.price.productVariantId ?? undefined,
        productComboId: i.price.productComboId ?? undefined,
        quantity: i.quantity,
      })),
    });
  });
};

const getOrderSummary = async (
  customerProfileId: string,
  couponCode?: string,
) => {
  return calculateCart(customerProfileId, couponCode);
};

const getInvoice = async (orderId: string) => {
  // warehouse name, location
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(orderId);
  const whereClause: Prisma.OrderWhereInput =
    !isMongoId || orderId.startsWith("order_")
      ? { razorpayOrderId: orderId }
      : { OR: [{ id: orderId }, { razorpayOrderId: orderId }] };

  const order = await prisma.order.findFirst({
    where: whereClause,
    // invoice No, Invoice Date, Order ID, Payment ID, order status
    // transaction id, payment time, payment date, mode of payment cod/online
    include: {
      // customer name, full delivery address, city, state
      createdBy: { include: { user: true } },
      address: true,
      coupon: true,

      items: {
        include: {
          price: {
            include: {
              //   vendor name, business name, vendor addresses, vendor state, city, location, PAN No, GSTRegistration No
              // product name hsn code, quantity, unit price, net amount, gst, total with tax, subtotal (without tax), total gst, overall total
              productVariant: {
                include: {
                  variant: true,
                  product: { include: { createdBy: true, hsn: true } },
                },
              },
              productCombo: {
                include: {
                  product: { include: { createdBy: true, hsn: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const oriringoVendor = await prisma.vendorProfile.findFirst({
    where: { isOriginO: true },
  });

  const allShipments = await Promise.all(
    order!.items.map((i) =>
      prisma.shipment.findMany({
        where: { orderItemIds: { has: i.id }, isReturn: false },
        include: { warehouse: true },
      }),
    ),
  );

  console.log("OrderItems: ", order?.items);
  console.log("Shipments: ", allShipments);

  const output = order?.items.reduce(
    (acc, curr, index) => {
      const itemType = curr.price.productVariant
        ? "productVariant"
        : "productCombo";
      const discountedPrice =
        curr.price.productVariant?.discountPercentage ?? 0;
      const basePrice = curr.price.price;
      const unitPrice = basePrice - basePrice * (discountedPrice / 100);
      const key = curr.price[itemType]?.product.createdById ?? "origino";
      const product = curr.price[itemType]?.product;

      const shipments: (Partial<Shipment> & {
        warehouse: Partial<Warehouse> | null;
      })[] = allShipments[index];
      if (!shipments.length) {
        shipments.push({
          warehouse: { state: "Unknown" },
          allocations: [{ orderItemId: curr.id, qty: curr.quantity }],
        });
      }

      if (acc[key]) {
        acc[key].items.push(
          ...shipments.map((s) => {
            return {
              id: curr.id,
              productName: curr.price[itemType]?.product.name,
              itemName:
                itemType === "productVariant"
                  ? curr.price.productVariant?.variant.name
                  : curr.price.productCombo?.name,
              hsnCode: curr.price[itemType]?.product.hsn?.hsnCode,
              gstRate: curr.price[itemType]?.product.hsn?.gstRate,
              quantity: curr.quantity,
              unitPrice,
              netAmount: unitPrice * curr.quantity,
              warehouseState: s.warehouse?.state,
              type:
                order.address.state === s.warehouse?.state
                  ? "INTRASTATE"
                  : "INTERSTATE",
              // @ts-expect-error prisma json are untyped
              allocations: s.allocations.filter(
                // @ts-expect-error prisma json are untyped
                (a) => a.orderItemId === curr.id,
              ),
            };
          }),
        );
        return acc;
      }

      acc[key] = {
        customer: {
          name: order.createdBy.user.name,
          address: order.address,
        },
        order: {
          id: order.id,
          status: order.status,
          paymentType: order.paymentType,
          razorpayOrderId: order.razorpayOrderId,
          razorpayPaymentId: order.razorpayPaymentId,
          subtotal: order.subtotal,
          gst: order.gst,
          couponDiscount: order.couponDiscount,
          createdAt: order.createdAt,
        },
        appliedCoupon: order.coupon?.code,
        items: [
          ...shipments.map((s) => {
            return {
              id: curr.id,
              productName: curr.price[itemType]?.product.name,
              itemName:
                itemType === "productVariant"
                  ? curr.price.productVariant?.variant.name
                  : curr.price.productCombo?.name,
              hsnCode: curr.price[itemType]?.product.hsn?.hsnCode,
              gstRate: curr.price[itemType]?.product.hsn?.gstRate,
              quantity: curr.quantity,
              unitPrice,
              netAmount: unitPrice * curr.quantity,
              warehouseState: s.warehouse?.state,
              type:
                order.address.state === s.warehouse?.state
                  ? "INTRASTATE"
                  : "INTERSTATE",
              // @ts-expect-error prisma json are untyped
              allocations: s.allocations.filter(
                // @ts-expect-error prisma json are untyped
                (a) => a.orderItemId === curr.id,
              ),
            };
          }),
        ],
      };

      if (product?.createdBy)
        acc[key].vendor = {
          name: product.createdBy.businessName,
          address: product.createdBy.companyAddress,
          pan: product.createdBy.panNumber,
          gst: product.createdBy.gstNumber,
        };
      else
        acc[key].vendor = {
          name: oriringoVendor?.businessName,
          address: oriringoVendor?.companyAddress,
          pan: oriringoVendor?.panNumber,
          gst: oriringoVendor?.gstNumber,
        };

      return acc;
    },
    {} as Record<string, any>,
  );

  // await HAS an effect
  return Object.values(output ?? {});
};

const orderService = {
  createOrder,
  getOrderById,
  getPaginatedOrders,
  updateOrder,
  deleteOrder,
  reorder,
  getOrderSummary,
  getInvoice,
  calculateCart,
};
export default orderService;
