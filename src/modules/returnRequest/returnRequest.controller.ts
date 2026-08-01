import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import prisma from "@/config/prisma";
import shipwayService from "@/services/shipway/shipway.service";
import { mapReturnsByShipmentWithProfilesToShipwayPayloads } from "@/services/shipway/mapper";
import { Prisma } from "@/generated/prisma";
import returnRequestService from "./returnRequest.service";

const createReturnRequest = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await returnRequestService.createReturnRequest(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "ReturnRequest is already exists",
      );
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "ReturnRequest created successfully",
    data: response,
  });
});

const getReturnRequestById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await returnRequestService.getReturnRequestById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "ReturnRequest fetched successfully",
    data: response,
  });
});

const getPaginatedReturnRequests = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "status"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  if (res.locals.currentUser.role.isVendor)
    filters.vendorId = res.locals.currentUser.vendorProfile.id;
  if (res.locals.currentUser.role.isCustomer)
    filters.customerId = res.locals.currentUser.customerProfile.id;

  const response = await returnRequestService.getPaginatedReturnRequests(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "ReturnRequests fetched successfully",
    data: response,
  });
});

const updateReturnRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  // Allow test override from body OR environment variable to enable/disable idempotency
  const enableIdempotency =
    typeof req.body?.enableReturnIdempotency === "boolean"
      ? req.body.enableReturnIdempotency
      : process.env.ENABLE_RETURN_IDEMPOTENCY !== "false"; // default true

  const refund = await returnRequestService.getReturnRequestById(id);
  if (!refund)
    throw new ApiError(httpStatus.NOT_FOUND, "ReturnRequest not found");

  let refundSuccess = true;
  if (data.status === "REFUNDED") {
    refundSuccess = false;
    if (refund.status === "REFUNDED")
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "ReturnRequest is already refunded",
      );
    if (refund.status !== "APPROVED")
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Only approved ReturnRequest can be refunded",
      );

    // handle online payment refund
    if (refund.refundMethod === "SOURCE") {
      if (!refund.order.razorpayPaymentId)
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Only online payment can be refunded to source",
        );

      if (refund.order.razorpayPaymentId) {
        // perform refund via provider (omitted)
        refundSuccess = true;
      }
    } else if (refund.refundMethod === "WALLET") {
      console.log("Refunding to wallet");
      await prisma.$transaction(async (tx) => {
        await tx.walletLogs.create({
          data: {
            customerProfileId: refund.order.createdBy.id,
            orderId: refund.order.id,
            amount: refund.orderItem.price,
            type: "CREDIT",
          },
        });
        await tx.customerProfile.update({
          where: { id: refund.order.createdBy.id },
          data: { wallet: { increment: refund.orderItem.price } },
        });
      });
      refundSuccess = true;
    }
  }

  let response;
  if (refundSuccess) {
    const { enableReturnIdempotency, ...uploadPayload } = data;
    response = await returnRequestService.updateReturnRequest(
      id,
      uploadPayload,
    );
  }
  res
    .status(refundSuccess ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR)
    .json({
      success: refundSuccess,
      message: refundSuccess
        ? "ReturnRequest updated successfully"
        : "Refund failed, something went wrong",
      data: response,
    });
  // }
});

const deleteReturnRequest = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await returnRequestService.deleteReturnRequest(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "ReturnRequest deleted successfully",
    data: response,
  });
});

const approveReturnRequestHandler = catchAsync(async (req, res) => {
  const rrId = req.params.id;
  const { carrierId } = req.body;
  const enableIdempotency = req.body?.enableIdempotency ?? true;

  // Helpers
  function mapRefundMethodToPaymentId(
    method?: string | null,
  ): number | undefined {
    if (!method) return undefined;
    switch ((method || "").toString().toUpperCase()) {
      case "BANK":
        return 1;
      case "UPI":
        return 2;
      case "PAYTM":
        return 3;
      case "GIFT_CARD":
        return 4;
      case "WALLET":
        return 5;
      case "SOURCE":
        return 6;
      default:
        return undefined;
    }
  }

  function computeRefundAmount(orderItem: any, qty: number): number {
    const unitPrice = Number(orderItem.price?.price ?? 0);
    const paisePerUnit = Math.round(unitPrice * 100);
    return paisePerUnit * qty;
  }

  try {
    // Load ReturnRequest with related orderItem -> order -> items (mapper needs these)
    const rr = await prisma.returnRequest.findUnique({
      where: { id: rrId },
      include: {
        orderItem: {
          include: {
            price: {
              include: {
                productVariant: { include: { product: true, variant: true } },
                productCombo: {
                  include: {
                    product: true,
                    items: {
                      include: {
                        productVariant: { include: { product: true } },
                      },
                    },
                  },
                },
              },
            },
            order: {
              include: {
                items: {
                  include: {
                    price: {
                      include: {
                        productVariant: {
                          include: { product: true, variant: true },
                        },
                        productCombo: {
                          include: {
                            items: { include: { productVariant: true } },
                          },
                        },
                      },
                    },
                  },
                },
                address: true,
                createdBy: { include: { user: true } },
              },
            },
          },
        },
      },
    });

    if (!rr)
      throw new ApiError(httpStatus.NOT_FOUND, "ReturnRequest not found");

    // Idempotency guard at high level (prevent creating returns twice)
    if (rr.isReturnCreated) {
      throw new ApiError(httpStatus.CONFLICT, "Return already created");
    }

    const order = rr.orderItem?.order;
    if (!order)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Associated order not found for this order item",
      );

    // Resolve return reason id when we only have free-text
    let resolvedReasonId: string | undefined;
    if (rr.reason && rr.reason.trim()) {
      resolvedReasonId = await shipwayService.ensureReturnReasonExists(
        rr.reason.trim(),
      );
    }

    const isCOD = !(order.razorpayPaymentId || order.razorpayOrderId);

    let refundPaymentId: number | undefined;
    let transferDetails: Record<string, unknown> | undefined;
    let shipwayHandlesRefund = false;

    // if (isCOD) {
    //   refundPaymentId = mapRefundMethodToPaymentId(rr.refundMethod as any);
    //   if (refundPaymentId === 1 && rr.bankInfo) {
    //     shipwayHandlesRefund = true;
    //     transferDetails = {
    //       bank_account: rr.bankInfo.acNo,
    //       ifsc: rr.bankInfo.ifsc,
    //       beneficiary_name: rr.bankInfo.acHolderName,
    //       account_number: rr.bankInfo.acNo,
    //       ifsc_code: rr.bankInfo.ifsc,
    //       account_type: "saving",
    //       bank_name: rr.bankInfo.bankName ?? undefined,
    //     };
    //   } else if (refundPaymentId === 5) {
    //     shipwayHandlesRefund = false;
    //     transferDetails = undefined;
    //   } else if (data.bankInfo) {
    //     refundPaymentId =
    //       refundPaymentId ??
    //       (data.bankInfo.account_number
    //         ? 1
    //         : data.bankInfo.upi_id
    //           ? 2
    //           : data.bankInfo.paytm_number
    //             ? 3
    //             : refundPaymentId);
    //     shipwayHandlesRefund = typeof refundPaymentId === "number";
    //     transferDetails = data.bankInfo;
    //   } else {
    //     shipwayHandlesRefund = true;
    //     refundPaymentId = 5;
    //     transferDetails = undefined;
    //   }
    // } else {
    shipwayHandlesRefund = true;
    refundPaymentId = 5;
    // }

    // Build mapper input (same as before)
    const priceRecord = rr.orderItem?.price;
    const productVariant = priceRecord?.productVariant;
    const productCombo = priceRecord?.productCombo;
    const isCombo = !!productCombo;
    const skuForMapper = isCombo
      ? productCombo!.id
      : (productVariant?.id ?? rr.orderItemId);
    let comboComposition:
      | { variantId?: string; qtyPerCombo?: number }[]
      | undefined;
    if (isCombo) {
      comboComposition = (productCombo?.items ?? []).map((ci) => ({
        variantId: ci.productVariant?.id,
        qtyPerCombo: ci.quantity ?? 1,
      }));
    }

    // derive original shipment for linking
    const originalShipment = await prisma.shipment.findFirst({
      where: {
        orderId: order.id,
        isReturn: { equals: false },
        orderItemIds: { has: rr.orderItemId },
      },
    });

    console.log("Original Shipment : ", originalShipment);

    // resolve carrier/return warehouse (same as before)
    // let derivedCarrierId: string | undefined;
    let derivedReturnWarehouseId: string | undefined;
    let vendorId: string | undefined =
      productVariant?.product?.createdById ??
      productCombo?.product?.createdById ??
      undefined;

    if (!vendorId && originalShipment)
      vendorId = originalShipment.vendorId ?? undefined;

    if (originalShipment) {
      // if (originalShipment.carrierId)
      //   derivedCarrierId = originalShipment.carrierId;
      if (originalShipment.warehouseId) {
        const wh = await prisma.warehouse.findUnique({
          where: { id: originalShipment.warehouseId },
          select: { shipwayWarehouseId: true, vendorId: true },
        });
        vendorId = vendorId ?? wh?.vendorId ?? undefined;
        if (wh?.shipwayWarehouseId)
          derivedReturnWarehouseId = wh.shipwayWarehouseId;
      }
    }

    const adminCarrierOverride =
      req.body && req.body.carrierId ? String(req.body.carrierId) : undefined;
    const adminWarehouseOverride =
      req.body && req.body.returnWarehouseId
        ? String(req.body.returnWarehouseId)
        : undefined;

    // const carrierIdToUse =
    //   adminCarrierOverride ?? derivedCarrierId ?? undefined;
    const carrierIdToUse = adminCarrierOverride ?? carrierId;
    const returnWarehouseIdToUse =
      adminWarehouseOverride ?? derivedReturnWarehouseId ?? undefined;
    console.log(
      "carrierId to use : ",
      carrierIdToUse,
      // "DERIVED : ",
      // derivedCarrierId,
    );

    const mapperInput: any = {
      orderId: order.id,
      contact: {
        ...(order?.createdBy?.user?.email
          ? {
              email: order.createdBy.user.email.split("#")[0]
                ? undefined
                : order.createdBy?.user?.email,
            }
          : {}),
        ...(order.createdBy?.user?.phone
          ? { phone: order.createdBy?.user?.phone }
          : {}),
      },
      products: [
        {
          sku: skuForMapper,
          returnQty: rr.quantity,
          returnReasonId: resolvedReasonId ?? undefined,
          returnReason: rr.reason ?? undefined,
          customerNotes: rr.adminNote ?? undefined,
          images: rr.imageUrls ?? undefined,
          desiredExchangeSku: undefined,
          ...(isCombo ? { comboComposition } : {}),
          ...(isCombo ? { isCombo: true } : {}),
        },
      ],
      returnType: "refund",
      orderDate: order.createdAt?.toISOString() ?? undefined,
      order_weight:
        (productVariant?.weightInGrams ?? productCombo?.weightInGrams ?? 0) *
        rr?.quantity,
      ...(shipwayHandlesRefund && typeof refundPaymentId === "number"
        ? { refundPaymentId }
        : {}),
      ...(shipwayHandlesRefund && transferDetails ? { transferDetails } : {}),
      ...(shipwayHandlesRefund ? { shipwayHandlesRefund: true } : {}),
      ...(carrierIdToUse ? { carrierId: carrierIdToUse } : {}),
      ...(returnWarehouseIdToUse
        ? { returnWarehouseId: returnWarehouseIdToUse }
        : {}),
    };

    // Produce Shipway payloads with mapper (existing logic)
    const payloads =
      await mapReturnsByShipmentWithProfilesToShipwayPayloads(mapperInput);
    if (!payloads || payloads.length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mapper did not produce any Shipway payloads",
      );
    }

    // send to Shipway (existing parallel logic)
    const sendResults = await Promise.all(
      payloads.map(async (p) => {
        try {
          const resp = await shipwayService.sendCreateReturnToShipway(
            p.payload,
          );
          return {
            shipwayOrderId: p.shipwayOrderId,
            ok: true,
            result: resp,
            orderItemIds: p.orderItemIds ?? [rr.orderItemId],
          };
        } catch (err) {
          return {
            shipwayOrderId: p.shipwayOrderId,
            ok: false,
            result: err,
            orderItemIds: p.orderItemIds ?? [rr.orderItemId],
          };
        }
      }),
    );

    console.log("SHIPWAY RESULT : ", sendResults);

    // ---------------- TRANSACTION: persist Shipway responses + create/ensure return shipments + stock credit ----------------
    await prisma.$transaction(async (tx) => {
      // update returnRequest summary
      sendResults.map((s) => {
        if (!(s.result as any)?.awb) {
          throw new ApiError(
            httpStatus?.FAILED_DEPENDENCY,
            "Shipway didn't create a pickup. Please select a different carrier and try again.",
          );
        }
      });
      await tx.returnRequest.update({
        where: { id: rrId },
        data: {
          isReturnCreated: true,
          shipwayMeta: sendResults.map((r) => ({
            shipwayOrderId: r.shipwayOrderId,
            ok: r.ok,
            result: r.result,
          })) as Prisma.InputJsonValue,
          // status: sendResults.every((s) => s.ok) ? "APPROVED" : "PENDING",
          journeyStatus: "PENDING",
          updatedAt: new Date(),
        },
      });

      // For each successful shipway result, either create a new return-shipment or update existing when idempotency is enabled
      for (const r of sendResults) {
        if (!r.ok) continue;

        const shipwayResp = r.result as {
          success: boolean;
          status?: number | undefined;
          data?: any;
          error?: any;
          rma_no?: string | null | undefined;
          awb?: string | null | undefined;
        };

        const rmaNo = shipwayResp.rma_no ?? shipwayResp?.data?.rma_no ?? null;
        const awb = shipwayResp?.awb ?? shipwayResp?.data?.awb ?? null;

        const metaSummary = {
          createdAt: new Date().toISOString(),
          shipwayOrderId: r.shipwayOrderId,
          rmaNo,
          awb,
          raw: JSON.parse(JSON.stringify(shipwayResp)),
        } as Prisma.InputJsonValue;

        const orderItemIdsForShipment: string[] =
          Array.isArray(r.orderItemIds) && r.orderItemIds.length
            ? r.orderItemIds
            : [rr.orderItemId];

        // Build allocations
        const allocationsForTx: Array<{
          orderItemId: string;
          productVariantId?: string | null;
          qty: number;
        }> = [];
        if (isCombo) {
          const comboItems = productCombo?.items ?? [];
          for (const ci of comboItems) {
            const variantId = ci.productVariant?.id ?? null;
            const qtyPerCombo = ci.quantity ?? 1;
            const totalQty = qtyPerCombo * rr.quantity;
            allocationsForTx.push({
              orderItemId: rr.orderItemId,
              productVariantId: variantId,
              qty: totalQty,
            });
          }
        } else {
          allocationsForTx.push({
            orderItemId: rr.orderItemId,
            productVariantId: productVariant?.id ?? null,
            qty: rr.quantity,
          });
        }

        if (enableIdempotency) {
          // Try to find an existing return-shipment with same returnRequestId + shipwayOrderId
          const existingReturnShipment = await tx.shipment.findFirst({
            where: {
              returnRequestId: rr.id,
              shipwayOrderId: r.shipwayOrderId,
            },
          });

          if (existingReturnShipment) {
            // Update existing return shipment (idempotent)
            await tx.shipment.update({
              where: { id: existingReturnShipment.id },
              data: {
                vendorId:
                  vendorId ?? existingReturnShipment.vendorId ?? undefined,
                warehouseId:
                  originalShipment?.warehouseId ??
                  existingReturnShipment.warehouseId ??
                  undefined,
                awb: awb ?? existingReturnShipment.awb ?? undefined,
                status: awb ? "CREATED" : "PENDING",
                carrierId:
                  (carrierIdToUse as string) ??
                  // existingReturnShipment.carrierId ??
                  undefined,
                allocations: allocationsForTx,
                shipwayMeta: metaSummary as Prisma.InputJsonValue,
                updatedAt: new Date(),
              },
            });

            // update RR meta too (store latest)
            await tx.returnRequest.update({
              where: { id: rr.id },
              data: {
                rmaNumber: rmaNo ?? undefined,
                shipwayMeta: metaSummary,
                journeyStatus: "PENDING",
                updatedAt: new Date(),
              },
            });
          } else {
            // create new return shipment (no existing one)
            await tx.shipment.create({
              data: {
                orderId: rr.orderItem.orderId,
                orderItemIds: orderItemIdsForShipment,
                shipwayOrderId: r.shipwayOrderId,
                vendorId: vendorId ?? undefined,
                warehouseId: originalShipment?.warehouseId ?? undefined,
                awb: awb ?? undefined,
                status: awb ? "CREATED" : "PENDING",
                carrierId: (carrierIdToUse as string) ?? undefined,
                pickupId: undefined,
                allocations: allocationsForTx,
                returnRequestId: rr.id,
                originalShipmentId: originalShipment?.id ?? undefined,
                isReturn: true,
                shipwayMeta: metaSummary as Prisma.InputJsonValue,
              },
            });

            await tx.returnRequest.update({
              where: { id: rr.id },
              data: {
                rmaNumber: rmaNo ?? undefined,
                shipwayMeta: metaSummary,
                journeyStatus: "PENDING",
                updatedAt: new Date(),
              },
            });
          }
        } else {
          // idempotency disabled: always create a new return shipment
          await tx.shipment.create({
            data: {
              orderId: rr.orderItem.orderId,
              orderItemIds: orderItemIdsForShipment,
              shipwayOrderId: r.shipwayOrderId,
              vendorId: vendorId ?? undefined,
              carrierId: (carrierIdToUse as string) ?? undefined,
              warehouseId: originalShipment?.warehouseId ?? undefined,
              awb: awb ?? undefined,
              status: awb ? "CREATED" : "PENDING",
              pickupId: undefined,
              allocations: allocationsForTx,
              returnRequestId: rr.id,
              originalShipmentId: originalShipment?.id ?? undefined,
              isReturn: true,
              shipwayMeta: metaSummary as Prisma.InputJsonValue,
            },
          });

          await tx.returnRequest.update({
            where: { id: rr.id },
            data: {
              rmaNumber: rmaNo ?? undefined,
              shipwayMeta: metaSummary,
              journeyStatus: "PENDING",
              updatedAt: new Date(),
            },
          });
        }
      } // end for sendResults

      // ----------------- STOCK CREDIT -----------------
      let stockWarehouseId: string | undefined;
      stockWarehouseId =
        stockWarehouseId ?? originalShipment?.warehouseId ?? undefined;

      if (stockWarehouseId) {
        if (isCombo && productCombo?.id) {
          // increment combo stock
          const comboId = productCombo.id;
          const combosToCredit = rr.quantity ?? 0;
          const upd = await tx.warehouseComboStock.updateMany({
            where: { warehouseId: stockWarehouseId, productComboId: comboId },
            data: { comboCount: { increment: combosToCredit } },
          });
          if (upd.count === 0) {
            await tx.warehouseComboStock.create({
              data: {
                warehouseId: stockWarehouseId,
                productComboId: comboId,
                comboCount: combosToCredit,
              },
            });
          }
        } else {
          // variant return -> increment variant stocks (fallback includes combo components)
          if (productVariant?.id) {
            const variantId = productVariant.id;
            const qty = rr.quantity ?? 0;
            const upd = await tx.warehouseStock.updateMany({
              where: {
                warehouseId: stockWarehouseId,
                productVariantId: variantId,
              },
              data: { productCount: { increment: qty } },
            });
            if (upd.count === 0) {
              await tx.warehouseStock.create({
                data: {
                  warehouseId: stockWarehouseId,
                  productVariantId: variantId,
                  productCount: qty,
                },
              });
            }
          } else if (productCombo?.items && productCombo.items.length > 0) {
            for (const ci of productCombo.items) {
              const variantId = ci.productVariant?.id;
              if (!variantId) continue;
              const qtyPerCombo = ci.quantity ?? 1;
              const totalQty = (rr.quantity ?? 0) * qtyPerCombo;
              const upd = await tx.warehouseStock.updateMany({
                where: {
                  warehouseId: stockWarehouseId,
                  productVariantId: variantId,
                },
                data: { productCount: { increment: totalQty } },
              });
              if (upd.count === 0) {
                await tx.warehouseStock.create({
                  data: {
                    warehouseId: stockWarehouseId,
                    productVariantId: variantId,
                    productCount: totalQty,
                  },
                });
              }
            }
          } else {
            console.warn(
              `ReturnRequest ${rr.id}: no variant mapping to credit variant stocks.`,
            );
          }
        }
      } else {
        console.warn(
          `ReturnRequest ${rr.id}: could not resolve warehouse to credit stock. Skipping stock update.`,
        );
      }
      // ----------------- END STOCK CREDIT ----------------
    }); // end transaction
    res.status(httpStatus.OK).json({
      success: true,
      message: "Carrier assigned, AWB generated and reverse pickup created",
      shipwayResponse: sendResults,
    });
  } catch (err: any) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      err?.message ?? String(err),
    );
  }
});

const getReturnStats = catchAsync(async (req, res) => {
  const stats = await returnRequestService.getReturnStats();
  res.status(httpStatus.OK).json({
    success: true,
    message: "Return stats fetched successfully",
    data: stats,
  });
});

const returnRequestController = {
  createReturnRequest,
  getReturnRequestById,
  getPaginatedReturnRequests,
  updateReturnRequest,
  deleteReturnRequest,
  approveReturnRequestHandler,
  getReturnStats,
};
export default returnRequestController;
