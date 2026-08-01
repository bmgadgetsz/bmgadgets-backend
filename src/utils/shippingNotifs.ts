/* eslint-disable */
import { Prisma } from "@/generated/prisma";
import {
  deliveryConfirmationTemplate,
  failedDeliveryAttemptTemplate,
  orderCancelledTemplate,
  orderShippedTemplate,
  outForDeliveryTemplate,
  pickupFailedTemplate,
  returnPickupConfirmedTemplate,
  returnPickupFailedTemplate,
  returnReceivedAtWarehouseTemplate,
  returnRejectedTemplate,
} from "@/template/email/Shipping";
import sendEmail from "./mail";
import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import { notifyUsers } from "./userNotifUtils";

type ShipmentWithOrder = Prisma.ShipmentGetPayload<{
  include: {
    order: {
      include: {
        address: true;
        createdBy: { include: { user: true } };
      };
    };
    returnRequest: true; // this will make returnRequest typed as ReturnRequest | null
    vendor: {
      include: {
        user: {
          select: {
            name: true;
            phone: true;
            id: true;
            email: true;
          };
        };
      };
    };
  };
}>;

export async function notifyByStatus({
  shipments,
  newStatus,
  payload,
}: {
  shipments: ShipmentWithOrder[];
  newStatus: string;
  payload: any;
  prisma: any; // prisma client (used only for returnRequest lookup)
}) {
  const webhookTime = payload?.status_time ?? null;

  for (const s of shipments) {
    try {
      const lastWebhook = (s.shipwayMeta as any)?.lastWebhook ?? null;
      const lastWebhookTime = lastWebhook?.status_time ?? null;

      // dedupe same webhook/time
      if (webhookTime && lastWebhookTime && webhookTime === lastWebhookTime) {
        continue;
      }

      const order = s?.order;
      // base recipient info from order
      const recipientEmail: string | null =
        order?.createdBy?.user?.email ?? null;
      const firstName: string | null = order?.createdBy?.user?.name ?? null;

      if (!recipientEmail) {
        console.warn(
          "No recipient email found for shipment",
          s.id,
          "— skipping notification",
        );
        continue;
      }

      const common = {
        firstName: firstName ?? undefined,
        orderId: s?.orderId ?? order?.id,
        awb: s.awb ?? payload?.awbno ?? payload?.awb ?? null,
        courier: payload?.carrier ?? null,
        trackUrl:
          s?.trackingUrl ??
          payload?.api_input?.tracking_url ??
          payload?.tracking_url ??
          null,
        estimatedDelivery:
          payload?.expected_delivery_date ?? s.expectedDelivery ?? null,
        address: order?.address?.address
          ? `${order.address?.address ?? ""} ${order.address?.city ?? ""}`
          : null,
        amountDue: s?.order?.subtotal ?? null,
      };

      let tpl: { subject: string; html: string } | null = null;

      const employeesToBeNotified = await prisma.user.findMany({
        where: {
          OR: [
            { role: { isAdmin: true } },
            {
              role: {
                permissions: {
                  some: {
                    resource: "ORDERS_AND_SHIPMENTS",
                    access: { hasSome: ["WRITE", "DELETE"] },
                  },
                },
              },
            },
          ],
        },
      });

      // Return-specific notifications
      if (s.isReturn) {
        const rejectionReason = s?.returnRequest?.reason ?? null;

        switch (newStatus) {
          case "RETURN_INITATED": {
            await prisma.notification.createMany({
              data: employeesToBeNotified.map((e) => ({
                type: "RETURN_INITATED",
                title: `Order ${s.orderId} returned to origin`,
                receiverId: e.id,
                orderId: s.orderId,
              })),
            });
            const io = getIO();
            employeesToBeNotified.forEach((vh) => {
              io.to(vh.id).emit("notification", {
                id: s.orderId,
              });
            });
            break;
          }

          case "PICKUP_SCHEDULED": {
            await prisma.notification.createMany({
              data: employeesToBeNotified.map((e) => ({
                type: "PICKUP_SCHEDULED",
                title: `Pickup scheduled for order ${s.orderId}`,
                receiverId: e.id,
                orderId: s.orderId,
              })),
            });
            const io = getIO();
            employeesToBeNotified.forEach((vh) => {
              io.to(vh.id).emit("notification", {
                id: s.orderId,
              });
            });

            // FOR VENDOR
            await notifyUsers({
              type: "PICKUP_SCHEDULED",
              title: `Pickup scheduled for order  ${s.orderId}.`,
              receiverIds: [s?.vendor?.user?.id!],
              orderId: s.orderId,
            });

            break;
          }
          case "RSCH":
          case "PICKED_UP":
          case "RPKP":
          case "RETURN_PICKED_UP":
            tpl = returnPickupConfirmedTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              returnId: s.returnRequestId ?? undefined,
              trackUrl: common.trackUrl,
            });
            break;

          case "RETURN_DELIVERED":
          case "RDEL":
          case "RETURN_RECEIVED":
            tpl = returnReceivedAtWarehouseTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              returnId: s.returnRequestId ?? undefined,
              trackUrl: common.trackUrl,
            });
            break;

          case "PICKUP_FAILED": {
            await prisma.notification.createMany({
              data: employeesToBeNotified.map((e) => ({
                type: "PICKUP_FAILED",
                title: `Pickup failed for order ${s.orderId}`,
                receiverId: e.id,
                orderId: s.orderId,
              })),
            });
            const io = getIO();
            employeesToBeNotified.forEach((vh) => {
              io.to(vh.id).emit("notification", {
                id: s.orderId,
              });
            });

            // FOR VENDOR
            await notifyUsers({
              type: "PICKUP_FAILED",
              title: `Pickup failed for order ${s.orderId} – action required.`,
              receiverIds: [s?.vendor?.user?.id!],
              orderId: s.orderId,
            });

            tpl = pickupFailedTemplate({
              vendorName: s?.vendor?.contactPersonName,
              orderId: s?.orderId,
            });

            break;
          }
          case "RPF":
            tpl = returnPickupFailedTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              atTime: payload?.status_time ?? null,
              trackUrl: common.trackUrl,
            });
            break;

          case "RETURN_REJECTED":
          case "RCAN":
          case "RETURN_CANCELLED":
            tpl = returnRejectedTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              reason: rejectionReason ?? undefined,
              supportLink: "https://yourapp.example.com/support",
            });
            break;

          default:
            tpl = null;
        }
      } else {
        // Non-return shipment notifications (your existing logic)
        switch (newStatus) {
          case "BOOKED":
          case "PICKUP_SCHEDULED":
          case "ON_HOLD":
          case "OUT_FOR_PICKUP": {
            tpl = orderShippedTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              awb: common.awb,
              courier: common.courier,
              estimatedDelivery: common.estimatedDelivery,
              trackUrl: common.trackUrl,
            });
            const orderItems = await prisma.orderItem.findMany({
              where: { orderId: order.id },
              select: {
                price: {
                  select: {
                    productVariant: {
                      select: { product: { select: { createdById: true } } },
                    },
                    productCombo: {
                      select: {
                        product: { select: { createdById: true } },
                      },
                    },
                  },
                },
              },
            });

            const vendorTobeNotified = await prisma.vendorProfile.findMany({
              where: {
                id: {
                  in: orderItems
                    .map(
                      (i) =>
                        i.price.productVariant?.product.createdById ??
                        i.price.productCombo?.product.createdById,
                    )
                    .filter(Boolean) as string[],
                },
              },
            });
            await prisma.notification.createMany({
              data: vendorTobeNotified.map((e) => ({
                type: "ORDER_SHIPPED",
                title: `Order ${order.id} shipped. Tracking: ${common.trackUrl}.`,
                receiverId: e.userId,
                orderId: order.id,
              })),
            });
            const io = getIO();
            vendorTobeNotified.forEach((vh) => {
              io.to(vh.userId).emit("notification", {
                id: order.id,
              });
            });

            break;
          }

          case "OUT_FOR_DELIVERY":
          case "OOD":
            tpl = outForDeliveryTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              awb: common.awb,
              amountDue: common.amountDue ?? undefined,
              address: common.address ?? undefined,
              trackUrl: common.trackUrl,
            });
            break;

          case "DELIVERED": {
            await prisma.notification.createMany({
              data: employeesToBeNotified.map((e) => ({
                type: "DELIVERED",
                title: `Order ${s.orderId} delivered successfully`,
                receiverId: e.id,
                orderId: s.orderId,
              })),
            });
            const io = getIO();
            employeesToBeNotified.forEach((vh) => {
              io.to(vh.id).emit("notification", {
                id: s.orderId,
              });
            });

            break;
          }
          case "RETURN_DELIVERED":
            tpl = deliveryConfirmationTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
            });
            break;

          case "UNDELIVERED":
          case "PENDING":
          case "FAILED_DELIVERY": {
            await prisma.notification.createMany({
              data: employeesToBeNotified.map((e) => ({
                type: "FAILED_DELIVERY",
                title: `Delivery attempt failed for order ${s.orderId}`,
                receiverId: e.id,
                orderId: s.orderId,
              })),
            });
            const io = getIO();
            employeesToBeNotified.forEach((vh) => {
              io.to(vh.id).emit("notification", {
                id: s.orderId,
              });
            });

            break;
          }

          case "NFI":
            tpl = failedDeliveryAttemptTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              atTime: payload?.status_time ?? null,
              trackUrl: common.trackUrl,
            });
            break;

          case "CANCELLED":
          case "RETURN_CANCELLED":
            tpl = orderCancelledTemplate({
              firstName: common.firstName,
              orderId: common.orderId,
              refundAmount: null,
              partial: false,
              supportLink: "https://yourapp.example.com/support",
            });
            break;

          default:
            tpl = null;
        }
      }

      if (tpl) {
        try {
          await sendEmail(recipientEmail, tpl.subject, tpl.html);
        } catch (e) {
          console.error("sendEmail failed for order", common.orderId, e);
        }
      }
    } catch (err) {
      console.error("notifyByStatus error for shipment", s.id, err);
    }
  }
}
