import env from "@/config/env";
import message91Templates from "@/config/message91Templates";
import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import { ReturnRequest, Prisma, NotificationType } from "@/generated/prisma";
import { sendMail } from "@/services/transporter.service";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import sendSms from "@/utils/sendSms";
import { z } from "zod";

const createReturnRequest = async (data: ReturnRequest) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: data.orderItemId },
    include: {
      order: {
        include: { createdBy: { include: { user: true } } },
      },
      price: {
        select: {
          productVariant: {
            select: {
              product: { select: { createdBy: true } },
            },
          },
          productCombo: {
            select: {
              product: {
                select: {
                  createdBy: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!orderItem) throw new Error("Order item not found");
  if (orderItem.returnedQuantity + data.quantity > orderItem.quantity)
    throw new Error("Return quantity exceeds purchased quantity");

  const returnRequest = await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: data.orderItemId },
      data: {
        returnedQuantity: {
          increment: data.quantity,
        },
      },
    });

    const newReturnRequest = await tx.returnRequest.create({
      data: { ...data, pickupAddressId: orderItem.order.addressId },
    });

    return newReturnRequest;
  });

  const { data: safeEmail } = z
    .string()
    .email()
    .safeParse(orderItem.order.createdBy.user.email);
  if (safeEmail)
    await sendMail(
      safeEmail,
      `Return Request Received — Order #${orderItem.orderId}`,
      `
        Hi ${orderItem.order.createdBy.user.name},<br>
        <p>We have received your return request for order #${orderItem.orderId}.</p>
        <p>Your pickup is scheduled soon. We’ll update you once the item is collected and inspected.</p>
        <p>Note: If the item is not eligible for return, we will notify you immediately.</p>
        <a href="[Link]">Track your return</a><br>
        `,
    );
  // Your return request for order ##Order_ID## is received. Pickup will be scheduled soon. Track: ##Tracking_Link##. Thanks ALIVELU AGRO PRIVATE LIMITED.
  await sendSms(
    message91Templates.returnRequestAcknowledgement,
    orderItem.order.createdBy.user.phone,
    {
      Order_ID: orderItem.orderId,
    },
  );

  const employeesToBeNotified = await prisma.user.findMany({
    where: {
      OR: [
        { role: { isAdmin: true } },
        {
          role: {
            permissions: {
              some: {
                resource: "REFUND_AND_RETURNS",
                access: { hasSome: ["WRITE", "DELETE"] },
              },
            },
          },
        },
      ],
    },
  });
  const vendor =
    orderItem.price.productVariant?.product.createdBy ??
    orderItem.price.productCombo?.product.createdBy;

  await prisma.notification.createMany({
    data: [
      ...employeesToBeNotified.map((e) => ({
        type: "RETURN_REQUEST_CREATED" as NotificationType,
        title: `Refund requested for order #${orderItem.orderId}.`,
        receiverId: e.id,
        returnRequestId: returnRequest.id,
      })),
      {
        type: "RETURN_REQUEST_CREATED",
        title: `Customer requested return for order #${orderItem.orderId}.`,
        receiverId: vendor?.userId as string,
        returnRequestId: returnRequest.id,
      },
    ],
  });
  const io = getIO();
  employeesToBeNotified.forEach((vh) => {
    io.to(vh.id).emit("notification", {
      id: returnRequest.id,
    });
  });
  io.to(vendor?.userId as string).emit("notification", {
    id: returnRequest.id,
  });

  sendMail(
    vendor?.email as string,
    `Return Request Received – Order #${orderItem.orderId}`,
    `Hi ${vendor?.contactPersonName},<br>
    <p>A customer has requested a return for Order #${orderItem.orderId}.</p>
    <p><strong>👉 <a href="${env.app.vendorPanelBaseUrl}/payments?tab=Refund+To+Client&returnId=${returnRequest.id}">Review Return</a></strong> <br /> - Orders Team</p>`,
  );

  return returnRequest;
};

const getReturnRequestById = async (id: string) => {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      pickupAddress: true,
      orderItem: {
        select: {
          price: {
            select: {
              price: true,
              productVariant: {
                select: {
                  discountPercentage: true,
                  variant: {
                    select: {
                      name: true,
                      subCategory: {
                        select: { category: { select: { name: true } } },
                      },
                    },
                  },
                  product: { select: { name: true, thumbnailImageUrl: true } },
                },
              },
              productCombo: {
                select: {
                  name: true,
                  product: {
                    select: {
                      name: true,
                      thumbnailImageUrl: true,
                      varients: {
                        take: 1,
                        select: {
                          variant: {
                            select: {
                              subCategory: {
                                select: {
                                  category: { select: { name: true } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          order: {
            select: {
              id: true,
              createdAt: true,
              razorpayOrderId: true,
              razorpayPaymentId: true,
              createdBy: {
                select: {
                  id: true,
                  user: { select: { name: true, phone: true, email: true } },
                  addresses: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!returnRequest) throw new Error("Return request not found");
  const { orderItem, ...rest } = returnRequest;
  const itemType = orderItem?.price.productVariant
    ? "productVariant"
    : "productCombo";
  const basePrice = orderItem?.price.price ?? 0;
  const discount = orderItem?.price.productVariant?.discountPercentage ?? 0;
  const finalPrice = basePrice - basePrice * (discount / 100);

  return {
    ...rest,
    pickupAddress: returnRequest.pickupAddress,
    orderId: orderItem?.order.id,
    order: orderItem?.order,
    customer: {
      name: orderItem?.order.createdBy.user.name,
      id: orderItem?.order.createdBy.id,
      phone: orderItem?.order.createdBy.user.phone,
      email: orderItem?.order.createdBy.user.email,
      addresses: orderItem?.order.createdBy.addresses,
    },
    orderDate: orderItem?.order.createdAt,
    orderItem: {
      productName: orderItem?.price[itemType]?.product.name,
      productImage: orderItem?.price[itemType]?.product.thumbnailImageUrl,
      productType: itemType,
      itemName:
        itemType === "productVariant"
          ? orderItem?.price.productVariant?.variant.name
          : orderItem?.price.productCombo?.name,
      categoryName:
        itemType === "productVariant"
          ? orderItem.price.productVariant?.variant.subCategory?.category.name
          : orderItem?.price.productCombo?.product.varients[0]?.variant
              .subCategory?.category.name,
      price: finalPrice * returnRequest.quantity,
    },
  };
};

const getPaginatedReturnRequests = async (
  filters: {
    search?: string;
    vendorId?: string;
    customerId?: string;
  } & Partial<ReturnRequest>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, vendorId, customerId, ...filterData } = filters;

  const conditions: Prisma.ReturnRequestWhereInput[] = [];

  const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

  if (vendorId)
    conditions.push({
      orderItem: {
        price: {
          OR: [
            { productVariant: { product: { createdById: vendorId } } },
            { productCombo: { product: { createdById: vendorId } } },
          ],
        },
      },
    });
  if (customerId)
    conditions.push({ orderItem: { order: { createdById: customerId } } });
  if (search && isValidObjectId(search)) {
    // partial match
    conditions.push({
      OR: ["id"].map((field) => ({
        [field]: {
          equals: search,
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
    await prisma.returnRequest.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      include: {
        orderItem: {
          select: {
            orderId: true,
            order: {
              select: {
                razorpayOrderId: true,
                razorpayPaymentMethod: true,
                createdBy: { select: { user: { select: { name: true } } } },
              },
            },
            price: {
              select: {
                price: true,
                productVariant: {
                  select: {
                    discountPercentage: true,
                    variant: { select: { name: true } },
                    product: {
                      select: {
                        thumbnailImageUrl: true,
                        imageUrls: true,
                        name: true,
                        createdBy: { select: { id: true, businessName: true } },
                      },
                    },
                  },
                },
                productCombo: {
                  select: {
                    name: true,
                    product: {
                      select: {
                        name: true,
                        createdBy: { select: { id: true, businessName: true } },
                        thumbnailImageUrl: true,
                        imageUrls: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      skip,
      take,
    }),
    await prisma.returnRequest.count({ where: whereConditions }),
  ]);

  // Amount
  return {
    meta: { total, page, limit: take },
    data: result.map((item) => {
      const { orderItem, ...rest } = item;
      const itemType = orderItem.price.productVariant
        ? "productVariant"
        : "productCombo";
      console.log(
        "IMAGE URL",
        orderItem.price[itemType]?.product.thumbnailImageUrl ??
          orderItem.price[itemType]?.product.imageUrls?.[0] ??
          null,
      );
      const basePrice = orderItem.price.price;
      const discount = orderItem.price.productVariant?.discountPercentage ?? 0;
      const finalPrice = basePrice - basePrice * (discount / 100);

      return {
        ...rest,
        orderType: orderItem.order.razorpayOrderId ? "ONLINE" : "COD",
        paymentMethod: orderItem.order.razorpayPaymentMethod ?? "COD",
        amount: finalPrice * item.quantity,
        orderItem: {
          productName: orderItem.price[itemType]?.product.name,
          productType: itemType,
          productThumbnailUrl:
            orderItem.price[itemType]?.product.thumbnailImageUrl ??
            orderItem.price[itemType]?.product.imageUrls?.[0] ??
            null,
          itemName:
            itemType === "productVariant"
              ? orderItem.price.productVariant?.variant.name
              : orderItem.price.productCombo?.name,
          vendorName:
            orderItem.price[itemType]?.product.createdBy?.businessName,
          customerName: orderItem.order.createdBy.user.name,
          orderId: orderItem.orderId,
        },
      };
    }),
  };
};

const updateReturnRequest = async (
  id: string,
  data: Partial<ReturnRequest>,
) => {
  const updatedReturnRequest = await prisma.returnRequest.update({
    where: { id },
    data,
    include: {
      orderItem: {
        select: {
          price: {
            select: {
              productVariant: {
                select: {
                  product: {
                    select: { createdBy: true },
                  },
                },
              },
              productCombo: {
                select: {
                  product: {
                    select: { createdBy: true },
                  },
                },
              },
            },
          },
          orderId: true,
          order: {
            select: {
              createdBy: {
                select: { user: { select: { email: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (updatedReturnRequest.status === "REJECTED") {
    const { data: safeEmail } = z
      .string()
      .email()
      .safeParse(updatedReturnRequest.orderItem.order.createdBy.user.email);
    if (safeEmail)
      await sendMail(
        safeEmail,
        `Return Request Update — Order #${updatedReturnRequest.orderItem.orderId}`,
        `
        Hi ${updatedReturnRequest.orderItem.order.createdBy.user.name},<br>
        <p>Unfortunately, the item in order #${updatedReturnRequest.orderItem.orderId} is not eligible for return.</p>
        ${updatedReturnRequest.rejectReason ? `<p><strong>Reason:</strong> ${updatedReturnRequest.rejectReason}</p>` : ""}
        ${updatedReturnRequest.detailedReason ? `<p><strong>Detailed Reason:</strong> ${updatedReturnRequest.detailedReason}</p>` : ""}
        <p>For details, please contact our support team: <a href="[Support Link]">Support Link</a></p>
      `,
      );
  }
  if (updatedReturnRequest.status === "APPROVED") {
    const updatedReturnRequestWithCalculatedPrice = await getReturnRequestById(
      updatedReturnRequest.id,
    );
    const employeesToBeNotified = await prisma.user.findMany({
      where: {
        OR: [
          { role: { isAdmin: true } },
          {
            role: {
              permissions: {
                some: {
                  resource: "REFUND_AND_RETURNS",
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
        type: "RETURN_REQUEST_APPROVED",
        title: `Refund of ₹${updatedReturnRequestWithCalculatedPrice.orderItem.price} processed for order #${updatedReturnRequest.orderItem.orderId}.`,
        receiverId: e.id,
        returnRequestId: updatedReturnRequest.id,
      })),
    });
    const io = getIO();
    employeesToBeNotified.forEach((vh) => {
      io.to(vh.id).emit("notification", {
        id: updatedReturnRequest.id,
      });
    });
  }

  if (data.status === "APPROVED" || data.status === "REJECTED") {
    const vendor =
      updatedReturnRequest.orderItem.price.productVariant?.product.createdBy ??
      updatedReturnRequest.orderItem.price.productCombo?.product.createdBy;

    await prisma.notification.create({
      data: {
        type:
          data.status === "APPROVED"
            ? "RETURN_REQUEST_APPROVED"
            : "RETURN_REQUEST_REJECTED",
        title: `Return ${data.status.toLowerCase()} for order #${updatedReturnRequest.orderItem.orderId}.`,
        receiverId: vendor?.userId as string,
        returnRequestId: updatedReturnRequest.id,
      },
    });
    const io = getIO();
    io.to(vendor?.userId as string).emit("notification", {
      id: updatedReturnRequest.id,
    });

    sendMail(
      vendor?.email as string,
      `Return ${data.status.toLowerCase()} – Order #${updatedReturnRequest.orderItem.orderId}`,
      `Hi ${vendor?.contactPersonName},<br>
      <p>The return for Order #${updatedReturnRequest.orderItem.orderId} has been <strong>${data.status.toLowerCase()}</strong>.</p>
      <p><strong>👉 <a href="${env.app.vendorPanelBaseUrl}/payments?tab=Refund+To+Client&returnId=${updatedReturnRequest.id}">View Details</a></strong> <br /> - Returns Team</p>`,
    );
  }

  return updatedReturnRequest;
};

const deleteReturnRequest = async (id: string) => {
  return prisma.returnRequest.delete({ where: { id } });
};

const getReturnStats = async () => {
  const [total, pending] = await Promise.all([
    prisma.returnRequest.count(),
    prisma.returnRequest.count({
      where: { status: "PENDING" },
    }),
  ]);

  return { total, pending };
};

const returnRequestService = {
  createReturnRequest,
  getReturnRequestById,
  getPaginatedReturnRequests,
  updateReturnRequest,
  deleteReturnRequest,
  getReturnStats,
};
export default returnRequestService;
