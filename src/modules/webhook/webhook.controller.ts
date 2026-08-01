import env from "@/config/env";
import message91Templates from "@/config/message91Templates";
import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import { JourneyStatus, Prisma, VendorPayoutStatus } from "@/generated/prisma";
import { sendMail } from "@/services/transporter.service";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import sendSms from "@/utils/sendSms";
import { notifyByStatus } from "@/utils/shippingNotifs";
import { createHmac } from "crypto";
import { status as httpStatus } from "http-status";

const razorpayxPayoutEvents = catchAsync(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"] as string;
  const body = JSON.stringify(req.body);

  // Validate signature
  const expectedSignature = createHmac("sha256", env.razorpayx.webhook_secret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Signature");
  }
  // Immediately acknowledge receipt
  res.status(httpStatus.OK).json({ status: "ok" });

  const { event } = req.body;
  const { payload } = req.body;

  console.log(payload); // eslint-disable-line no-console

  const payoutEntity = req.body.payload?.payout?.entity;

  if (!payoutEntity) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid payload");
  }

  // const payoutId = payoutEntity.id;

  // Use internal vendor payout ID from notes
  const vendorPayoutId = payoutEntity.notes?.vendor_payout_id;

  if (!vendorPayoutId) {
    console.log("No vendor payout ID in notes, skipping"); // eslint-disable-line no-console
    return;
  }

  // Map Razorpay event to your enum
  let status: VendorPayoutStatus;

  // // 🔹 Idempotency check (skip if already processed)
  // const alreadyProcessed = await prisma.webhookLog.findUnique({
  //   where: { razorpayEventId: payoutId },
  // });

  // if (alreadyProcessed) {
  //   return res
  //     .status(httpStatus.OK)
  //     .json({ event, status: "duplicate_skipped" });
  // }

  // // Save log entry to ensure we don't process it again
  // await prisma.webhookLog.create({
  //   data: {
  //     razorpayEventId: payoutId,
  //     event,
  //     processedAt: new Date(),
  //   },
  // });

  switch (event) {
    case "payout.initiated":
      status = "INITIATED";
      break;
    case "payout.pending":
      status = "PENDING";
      break;
    case "payout.processed":
      status = "COMPLETED";
      break;
    case "payout.reversed":
      status = "REVERSED";
      break;
    case "payout.failed":
      status = "FAILED";
      break;
    case "payout.rejected":
      status = "REJECTED";
      break;
    default:
      console.log("Unhandled event", event); // eslint-disable-line no-console
      return;
  }

  // Update vendor payout by internal ID
  const vendorPayout = await prisma.vendorPayout.update({
    where: { id: vendorPayoutId },
    data: {
      status,
      razorpayPayoutId: payoutEntity.id, // optional: store Razorpay ID too
      razorpayReferenceId: payoutEntity.reference_id,
    },
    include: {
      vendorProfile: true,
      items: {
        include: {
          orderItem: {
            include: {
              price: {
                include: { productVariant: true, productCombo: true },
              },
            },
          },
        },
      },
    },
  });

  const grossSale = vendorPayout!.items!.reduce((sum, item) => {
    const basePrice = item.orderItem.price.price;
    const discountPercentage =
      item.orderItem.price.productVariant?.discountPercentage ?? 0;
    const finalPrice = basePrice - basePrice * (discountPercentage / 100);

    return sum + finalPrice * item.orderItem.quantity;
  }, 0);

  const totalCommission = vendorPayout!.items!.reduce(
    (sum, item) =>
      sum +
      item.orderItem.price.price *
        item.orderItem.quantity *
        (item.commission / 100),
    0,
  );

  const payoutGst = totalCommission * 0.18;
  const netPayment =
    grossSale - (totalCommission + payoutGst + (vendorPayout!.marketFee ?? 0));

  if (
    ["INITIATED", "COMPLETED", "REJECTED", "REVERSED"].includes(
      vendorPayout.status,
    )
  ) {
    await prisma.notification.create({
      data: {
        type:
          // eslint-disable-next-line no-nested-ternary
          vendorPayout.status === "INITIATED"
            ? "PAYOUT_INITIATED"
            : vendorPayout.status === "COMPLETED"
              ? "PAYOUT_COMPLETED"
              : "PAYOUT_REJECTED",
        title:
          // eslint-disable-next-line no-nested-ternary
          vendorPayout.status === "INITIATED"
            ? `Payout of ₹${netPayment} initiated by Admin.`
            : vendorPayout.status === "COMPLETED"
              ? `Payout of ₹${netPayment} credited to your account.`
              : `Payout request #${vendorPayout.id} rejected.`,
        receiverId: vendorPayout.vendorProfile.userId,
        vendorPayoutId: vendorPayout.id,
      },
    });
    const io = getIO();
    io.to(vendorPayout.vendorProfile.userId).emit("notification", {
      id: vendorPayout.id,
    });

    if (vendorPayout.status === "COMPLETED")
      sendMail(
        vendorPayout.vendorProfile.email,
        `Payout Credited – ₹${netPayment}`,
        `Hi ${vendorPayout.vendorProfile.contactPersonName},<br>Your payout of ₹${netPayment} has been credited.<br>Txn Ref: ${vendorPayout.razorpayPayoutId}<br><a href="${env.app.vendorPanelBaseUrl}/payments?tab=Payout+History&vendorPayoutId=${vendorPayout.id}">👉 View Payment History</a><br>-Finance Team`,
      );
    if (
      vendorPayout.status === "REJECTED" ||
      vendorPayout.status === "REVERSED"
    )
      sendMail(
        vendorPayout.vendorProfile.email,
        `Payout Rejected – Action Required`,
        `Hi ${vendorPayout.vendorProfile.contactPersonName},<br>Your payout request was rejected.<br><a href="${env.app.vendorPanelBaseUrl}/payments?tab=Manage+Payouts">👉 Manage Payouts</a><br>-Finance Team`,
      );
  }

  // res.status(httpStatus.OK).json({ event, status: "ok" });
});

const shipway = catchAsync(async (req, res) => {
  const payload = req.body as any;

  // if (req.headers["x-shipway-secret"] !== env.shipway.webhook_secret) {
  //   throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid webhook signature");
  // }

  if (!payload) throw new ApiError(httpStatus.BAD_REQUEST, "Payload not found");
  console.log("Shipway payload from Webhook: ", payload);

  // --- Identify AWB / OrderId / Reverse AWB ---
  const awb = payload.awbno ?? payload.awb ?? payload?.api_input?.awbno ?? null;
  const reverseAwb = payload.reverse_tracking_number ?? null;
  const orderIdFromPayload =
    payload.order_id ?? payload?.api_input?.order_id ?? null;

  type ShipmentWithOrder = Prisma.ShipmentGetPayload<{
    include: {
      order: {
        include: {
          address: true;
          createdBy: {
            include: { user: true };
          };
        };
      };
      returnRequest: true;
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

  let shipments: ShipmentWithOrder[] = [];
  if (awb) {
    shipments = await prisma.shipment.findMany({
      where: { awb },
      include: {
        order: {
          include: {
            address: true,
            createdBy: {
              include: {
                user: true,
              },
            },
          },
        },
        returnRequest: true,
        vendor: {
          include: {
            user: true,
          },
        },
      },
    });
  }
  if ((!shipments || shipments.length === 0) && reverseAwb) {
    shipments = await prisma.shipment.findMany({
      where: { awb: reverseAwb },
      include: {
        order: {
          include: {
            address: true,
            createdBy: {
              include: {
                user: true,
              },
            },
          },
        },
        returnRequest: true,
        vendor: {
          include: {
            user: true,
          },
        },
      },
    });
  }
  if ((!shipments || shipments.length === 0) && orderIdFromPayload) {
    shipments = await prisma.shipment.findMany({
      where: { shipwayOrderId: String(orderIdFromPayload) },
      include: {
        order: {
          include: {
            address: true,
            createdBy: {
              include: {
                user: true,
              },
            },
          },
        },
        returnRequest: true,
        vendor: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  if (!shipments || shipments.length === 0) {
    res.status(200).json({ ok: true, note: "No matching shipment" });
    return;
  }

  // --- Map Shipway status code to a canonical string used in your DB ---
  const statusCode = payload.api_input?.current_status ?? "";

  const mapCourierToLocalStatus = (c: string): string => {
    const code = (c ?? "").toUpperCase();

    switch (code) {
      case "DEL":
        return "DELIVERED";
      case "INT":
        return "IN_TRANSIT";
      case "UND":
        return "UNDELIVERED";
      case "RTO":
        return "RETURN_INITIATED";
      case "RTD":
        return "RETURN_DELIVERED";
      case "CAN":
      case "PCAN":
        return "CANCELLED";
      case "SCH":
        return "BOOKED";
      case "ONH":
        return "ON_HOLD";
      case "OOD":
        return "OUT_FOR_DELIVERY";
      case "NFI":
      case "NFIDS":
        return "PENDING";
      case "RSCH":
        return "PICKUP_SCHEDULED";
      case "ROOP":
        return "OUT_FOR_PICKUP";
      case "RPKP":
        return "RETURN_PICKED_UP";
      case "RDEL":
        return "RETURN_DELIVERED";
      case "RINT":
        return "RETURN_IN_TRANSIT";
      case "RPSH":
        return "PICKUP_RESCHEDULED";
      case "RCAN":
        return "RETURN_CANCELLED";
      case "RCLO":
        return "RETURN_CLOSED";
      case "RSMD":
        return "PICKUP_DELAYED";
      case "RPF":
        return "PICKUP_FAILED";
      default:
        return "IN_TRANSIT";
    }
  };

  const newStatus = mapCourierToLocalStatus(statusCode);

  // pick latest scan / api_input - helpful for metadata
  const latestScan =
    (payload.scans &&
      (Array.isArray(payload.scans)
        ? payload.scans[0]
        : payload.scans[Object.keys(payload.scans).sort().reverse()[0]])) ??
    payload.api_input?.scans?.[0] ??
    null;

  // --- Build normalized scan timeline from payload.scans / api_input.scans ---
  const buildScansArray = (pl: any) => {
    const scansRaw = pl.scans ?? pl.api_input?.scans ?? null;
    if (!scansRaw) return [];

    const arr = Array.isArray(scansRaw)
      ? scansRaw.map((s: any) => ({ ...s }))
      : Object.keys(scansRaw)
          .sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return 0;
          })
          .map((k) => ({ ...(scansRaw[k] ?? {}) }));

    return arr
      .map((s: any, idx: number) => {
        const time = s.time ?? s.status_time ?? s.datetime ?? null;
        return {
          statusText: s.status ?? s.current_status_desc ?? s.statusText ?? null,
          time,
          location: s.location ?? s.from ?? s.to ?? null,
          raw: s,
          _idx: idx,
        };
      })
      .filter((x) => x.time || x.statusText)
      .sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : a._idx;
        const tb = b.time ? new Date(b.time).getTime() : b._idx;
        return ta - tb;
      });
  };

  const scansFromPayload = buildScansArray(payload);

  // Helper to normalize a single scan: prefer mapping scan.statusText -> mapped; if vague, fallback to newStatus.
  const normalizeScan = (scan: any, fallbackStatus: string) => {
    const mapped = mapCourierToLocalStatus(
      scan?.raw?.current_status ?? scan?.raw?.status ?? scan?.statusText ?? "",
    );
    const final = mapped ?? fallbackStatus ?? "IN_TRANSIT";
    return {
      status: final,
      time: scan.time ?? null,
      label:
        scan.statusText ??
        (scan.raw && (scan.raw.status || scan.raw.current_status_desc)) ??
        null,
      location: scan.location ?? null,
      raw: scan.raw ?? null,
    };
  };

  // --- Helper: parse expected delivery from common fields ---
  const parseExpectedDelivery = (pl: any): Date | null => {
    // Shipway may send expected_delivery_date as "YYYY-MM-DD" or ISO datetime or inside extra_fields
    const candidates = [
      pl.expected_delivery_date,
      pl.api_input?.extra_fields?.expected_delivery_date,
      pl.api_input?.expected_delivery_date,
      pl.api_input?.extra_fields?.expected_delivery_date,
      pl.api_input?.extra_fields?.expected_delivery_date, // safe repeat
    ].filter(Boolean);

    for (const c of candidates) {
      try {
        const d = new Date(String(c));
        if (!Number.isNaN(d.getTime())) return d;
      } catch (e) {
        // ignore
      }
    }
    return null;
  };

  const expectedDeliveryDate = parseExpectedDelivery(payload);

  console.log({ sl: shipments.length });
  // --- Update Shipments --- (persist shipwayMeta merged + trackingHistory + trackingStatus + expected/delivered timestamps)
  const updates = shipments.map((s) => {
    // existing trackingHistory might be stored as JSON or null
    const existingHistory: any[] =
      ((s as any).trackingHistory as any[]) ??
      ((s as any).shipwayMeta?.trackingHistory as any[]) ??
      [];

    const normalizedExisting = (existingHistory ?? []).map((h: any) => ({
      status: h.status,
      time: h.time,
      label: h.label ?? h.statusText ?? null,
      location: h.location ?? null,
      raw: h.raw ?? null,
    }));

    // Build new entries from scans. Use newStatus as fallback for ambiguous scans.
    const newEntries = scansFromPayload.map((scan) =>
      normalizeScan(scan, newStatus),
    );

    // Also include a top-level summary event from payload if there were no scans or to capture current_status time
    const topLevelTime =
      payload.status_time ??
      payload.scans_current_status_time ??
      payload.api_input?.status_time ??
      null;
    if (
      (newEntries.length === 0 ||
        !newEntries.some((e) => e.time === topLevelTime)) &&
      topLevelTime
    ) {
      newEntries.push({
        status: newStatus,
        time: topLevelTime,
        label:
          payload.current_status_desc ??
          payload.api_input?.current_status_desc ??
          null,
        location: payload.from ?? payload.to ?? null,
        raw: payload,
      });
    }

    // Merge existing + new, dedupe by (status + time) key
    const mergedMap = new Map<string, any>();
    const pushToMap = (entry: any) => {
      const key = `${entry.status ?? "UNK"}::${entry.time ?? JSON.stringify(entry.raw) ?? Math.random()}`;
      if (!mergedMap.has(key)) mergedMap.set(key, entry);
    };

    normalizedExisting.forEach(pushToMap);
    newEntries.forEach(pushToMap);

    const mergedArray = Array.from(mergedMap.values()).sort(
      (a: any, b: any) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return ta - tb;
      },
    );

    // Determine latest normalized status (take last element's status, fallback to newStatus)
    const latestNormalized = mergedArray.length
      ? mergedArray[mergedArray.length - 1].status
      : newStatus;

    // Set deliveredAt if latestNormalized indicates delivery
    let deliveredAt: Date | null = null;
    if (["DELIVERED", "RETURN_DELIVERED"].includes(latestNormalized)) {
      // prefer the timestamp of the last delivery event
      const lastDeliveryEvent = [...mergedArray]
        .reverse()
        .find((e) => ["DELIVERED", "RETURN_DELIVERED"].includes(e.status));
      if (lastDeliveryEvent && lastDeliveryEvent.time) {
        const d = new Date(lastDeliveryEvent.time);
        if (!Number.isNaN(d.getTime())) deliveredAt = d;
      } else if (topLevelTime) {
        const d = new Date(topLevelTime);
        if (!Number.isNaN(d.getTime())) deliveredAt = d;
      } else if (latestScan?.time) {
        const d = new Date(latestScan.time);
        if (!Number.isNaN(d.getTime())) deliveredAt = d;
      }
    }

    // Build shipwayMeta merge
    const mergedShipwayMeta = {
      ...((s as any).shipwayMeta ?? {}),
      trackingHistory: mergedArray,
      lastWebhook: payload,
      lastScan: latestScan ?? (s as any).shipwayMeta?.lastScan ?? null,
      api_input: {
        ...(payload.api_input ?? (s as any).shipwayMeta?.api_input ?? null),
      },
    };

    // Build update payload for prisma; pass Date objects where applicable
    console.log({ newStatus });
    return prisma.shipment.update({
      where: { id: s.id },
      data: {
        status: newStatus,
        trackingStatus: latestNormalized,
        trackingHistory: mergedArray,
        expectedDelivery:
          expectedDeliveryDate ?? (s as any).expectedDelivery ?? null,
        deliveredAt: deliveredAt ?? (s as any).deliveredAt ?? null,
        awb: awb ?? reverseAwb ?? s.awb,
        // carrierId:
        //   payload?.api_input?.carrier_id ?? payload?.carrier ?? s.carrierId,
        trackingUrl: payload?.api_input?.tracking_url ?? payload?.tracking_url,
        pickupDate: payload?.pickupdate,
        shipwayMeta: mergedShipwayMeta,
        updatedAt: new Date(),
      },
    });
  });

  await prisma.$transaction(updates);

  // --- Side effects for OrderItems (shipmentStatus strings kept as-is) ---
  const updateOrderItems = (status: string) =>
    shipments.flatMap((s) =>
      (s.orderItemIds ?? []).map((oiId) =>
        prisma.orderItem.update({
          where: { id: oiId },
          data: { shipmentStatus: status },
        }),
      ),
    );

  if (["DELIVERED", "RETURN_DELIVERED"].includes(newStatus)) {
    await prisma.$transaction(updateOrderItems("DELIVERED"));
  } else if (newStatus === "OUT_FOR_DELIVERY") {
    await prisma.$transaction(updateOrderItems("OUT_FOR_DELIVERY"));
  } else if (newStatus === "RETURNED") {
    await prisma.$transaction(updateOrderItems("RETURNED"));
  } else if (newStatus === "CANCELLED") {
    const orderItemTx = updateOrderItems("CANCELLED");
    const uniqueOrderIds = Array.from(new Set(shipments.map((s) => s.orderId)));
    const orderTx = uniqueOrderIds.map((oid) =>
      prisma.order.update({
        where: { id: oid },
        data: { status: "CANCELLED" },
      }),
    );
    if (orderItemTx.length || orderTx.length) {
      await prisma.$transaction([...orderItemTx, ...orderTx]);
    }
  }

  // --- If reverse shipment, update ReturnRequest.journeyStatus using enum ---
  function mapToReturnJourneyEnum(s: string): JourneyStatus {
    switch (s) {
      case "PICKUP_SCHEDULED":
      case "RSCH":
        return JourneyStatus.PICKUP_SCHEDULED;
      case "RETURN_PICKED_UP":
      case "RPKP":
        return JourneyStatus.PICKED_UP;
      case "RETURN_IN_TRANSIT":
      case "RINT":
        return JourneyStatus.RETURN_IN_TRANSIT;
      case "RETURN_DELIVERED":
      case "RDEL":
        return JourneyStatus.RETURN_DELIVERED;
      case "RETURN_CANCELLED":
      case "RCAN":
        return JourneyStatus.RETURN_CANCELLED;
      case "PICKUP_FAILED":
      case "RPF":
        return JourneyStatus.PICKUP_FAILED;
      case "PICKUP_DELAYED":
      case "RSMD":
        return JourneyStatus.PICKUP_DELAYED;
      case "RETURN_CLOSED":
      case "RCLO":
        return JourneyStatus.RETURN_DELIVERED;
      default:
        return JourneyStatus.PENDING;
    }
  }

  for (const s of shipments) {
    if (s.isReturn && s.returnRequestId) {
      const journeyEnum = mapToReturnJourneyEnum(newStatus);

      // Update the ReturnRequest.journeyStatus and merge shipwayMeta there too
      await prisma.returnRequest.update({
        where: { id: s.returnRequestId },
        data: {
          shipwayMeta: {
            ...((s as any).shipwayMeta ?? {}),
            lastWebhook: payload,
            lastScan: latestScan ?? null,
            api_input: payload.api_input ?? null,
            trackingHistory:
              ((payload.scans && buildScansArray(payload)) ||
                (s as any).shipwayMeta?.trackingHistory) ??
              null,
          },
          updatedAt: new Date(),
          journeyStatus: journeyEnum,
        },
      });
    }
  }

  try {
    await notifyByStatus({
      shipments,
      newStatus,
      payload,
      prisma,
      // sendSMSFn: sendSMS /* optional */,
    });
    if (newStatus === "OUT_FOR_DELIVERY") {
      // Hi ##Name##, Your order ##Order_ID## is out for delivery today. Amount due: Rs ##Amount##. Track your delivery here: ##Tracking_Link##. Thanks ALIVELU AGRO PRIVATE LIMITED.
      const { order } = shipments[0];
      sendSms(
        message91Templates.outForDeliveryNotification,
        shipments[0].order.createdBy.user.phone,
        {
          Name: shipments[0].order.createdBy.user.name!,
          Order_ID: shipments[0].order.id,
          Amount: String(
            order.subtotal +
              order.gst +
              order.shippingCost -
              order.couponDiscount,
          ),
          Tracking_Link: shipments[0].trackingUrl ?? "N/A",
        },
      );
    } else if (newStatus === "DELIVERED") {
      // Hi ##Name##, your order ##Order_ID## has been delivered. We hope you enjoy it! Thanks, ALIVELU AGRO PRIVATE LIMITED.
      const { order } = shipments[0];
      sendSms(
        message91Templates.deliveryConfirmationNotification,
        order.createdBy.user.phone,
        {
          Name: order.createdBy.user.name!,
          Order_ID: order.id,
        },
      );
    } else if (newStatus === "IN_TRANSIT") {
      // Your order ##Order_ID## has been shipped via ##Name##.Tracking ID: ##Tracking_ID##. Track here: ##Tracking_link##. Thanks ALIVELU AGRO PRIVATE LIMITED.
      const { order } = shipments[0];
      sendSms(
        message91Templates.orderShippedNotification,
        order.createdBy.user.phone,
        {
          Order_ID: order.id,
          Name: order.createdBy.user.name!,
          Tracking_ID: shipments[0].awb ?? "N/A",
          Tracking_link: shipments[0].trackingUrl ?? "N/A",
        },
      );
    }
  } catch (err) {
    console.error("Failed to send shipment notifications:", err);
  }

  res.status(200).json({
    ok: true,
    shipmentsUpdated: shipments.length,
    mappedStatus: newStatus,
  });
});

const webhookController = { razorpayxPayoutEvents, shipway };

export default webhookController;
