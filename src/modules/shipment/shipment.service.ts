// src/modules/shipment/shipment.service.ts
import prisma from "@/config/prisma";
import { Prisma } from "@/generated/prisma";
import isValidObjectId from "@/utils/isValidObjectId";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { startOfDay, endOfDay } from "date-fns";

type ShipmentFilters = {
  search?: string;
  status?: string;
  vendorId?: string;
  isReturn?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  orderId?: string;
  awb?: string;
  orderItemId?: string;
  isException?: string | boolean;
};

const getPaginatedShipments = async (
  filters: ShipmentFilters,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);

  const {
    search,
    status,
    vendorId,
    isReturn,
    createdAtFrom,
    createdAtTo,
    orderId,
    awb,
    orderItemId,
    isException,
  } = filters;

  const conditions: Prisma.ShipmentWhereInput[] = [];

  if (search) {
    if (isValidObjectId(search)) conditions.push({ orderId: search });
    else
      conditions.push({
        OR: [
          { awb: { contains: search, mode: "insensitive" } },
          { shipwayOrderId: { contains: search, mode: "insensitive" } },
          { orderId: search },
        ],
      });
  }

  const exceptionStatuses = ["PICKUP_FAILED", "UNDELIVERED"];

  if (typeof isException !== "undefined") {
    const truthy = isException === true || isException === "true";
    if (truthy) {
      conditions.push({
        OR: [
          { trackingStatus: { in: exceptionStatuses } },
          { status: { in: exceptionStatuses } },
        ],
      });
    } else {
      conditions.push({
        AND: [
          {
            NOT: {
              OR: [
                { trackingStatus: { in: exceptionStatuses } },
                { status: { in: exceptionStatuses } },
              ],
            },
          },
        ],
      });
    }
  } else if (status) conditions.push({ status });
  if (vendorId) conditions.push({ vendorId });
  if (typeof isReturn !== "undefined") {
    conditions.push({ isReturn: isReturn === "true" || isReturn === "1" });
  }
  if (orderId) conditions.push({ orderId });
  if (awb) conditions.push({ awb });

  if (createdAtFrom || createdAtTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (createdAtFrom) dateFilter.gte = startOfDay(new Date(createdAtFrom));
    if (createdAtTo) dateFilter.lte = endOfDay(new Date(createdAtTo));
    conditions.push({ createdAt: dateFilter });
  }

  if (orderItemId) {
    conditions.push({ orderItemIds: { has: orderItemId } });
  }

  const where = conditions.length ? { AND: conditions } : {};

  // Fetch shipments + related order with full order.items (we need price/variant/combo/hsn for amount computation)
  const [data, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: {
        [sortBy || "createdAt"]: (sortOrder as Prisma.SortOrder) || "desc",
      },
      take,
      skip,
      include: {
        order: {
          select: {
            id: true,
            status: true,
            subtotal: true,
            createdAt: true,
            address: {
              select: {
                address: true,
                city: true,
                state: true,
                zipcode: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
            // <-- IMPORTANT: include items + price metadata used by mapper logic
            items: {
              select: {
                id: true,
                quantity: true,
                price: {
                  select: {
                    price: true,
                    productVariant: {
                      select: {
                        id: true,
                        discountPercentage: true,
                        product: {
                          select: {
                            id: true,
                            name: true,
                            hsn: { select: { gstRate: true } },
                          },
                        },
                        variant: { select: { name: true } },
                      },
                    },
                    productCombo: {
                      select: {
                        id: true,
                        name: true,
                        items: {
                          select: {
                            quantity: true,
                            productVariant: {
                              select: {
                                id: true,
                                product: {
                                  select: {
                                    id: true,
                                    name: true,
                                    hsn: { select: { gstRate: true } },
                                  },
                                },
                                variant: { select: { name: true } },
                              },
                            },
                          },
                        },
                        product: {
                          select: {
                            id: true,
                            name: true,
                            hsn: { select: { gstRate: true } },
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
        vendor: {
          select: { id: true, businessName: true, mobileNumber: true },
        },
        warehouse: {
          select: {
            id: true,
            title: true,
            city: true,
            shipwayWarehouseId: true,
          },
        },
        returnRequest: { select: { id: true, status: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  // Compute amount per shipment
  // We'll mutate a new array to keep original `data` intact shape wise but attach amount & taxes
  const dataWithAmount = data.map((sh) => {
    let amountNum = 0;
    let taxesNum = 0;

    // guard: order or order.items may be absent
    const orderObj = sh.order as any | undefined;
    const orderItems: any[] = orderObj?.items ?? [];

    // if shipment has explicit allocations, you might want to use allocations instead of orderItemIds,
    // but to match mapper we sum the order.items included on the shipment for only the IDs in orderItemIds.
    const itemIdsInShipment = Array.isArray(sh.orderItemIds)
      ? new Set(sh.orderItemIds)
      : new Set<string>();

    for (const oi of orderItems) {
      if (!itemIdsInShipment.has(oi.id)) continue;

      const priceRec = oi.price ?? null;
      const qtyOrdered = Number(oi.quantity ?? 0);

      if (!priceRec) {
        // fallback: skip or treat as zero
        continue;
      }

      // Combo priced item
      if (priceRec.productCombo) {
        const combo = priceRec.productCombo;
        const comboPricePerCombo = Number(priceRec.price ?? 0);
        const combosOrdered = qtyOrdered;

        // compute total units per combo to split combo price across components
        const itemsArr = combo.items ?? [];
        const totalUnitsPerCombo = itemsArr.reduce(
          (s: number, c: any) => s + (c.quantity ?? 1),
          0,
        );

        // if composition missing -> treat as single combo line
        if (!itemsArr || itemsArr.length === 0 || totalUnitsPerCombo === 0) {
          const lineTotal = comboPricePerCombo * combosOrdered;
          // try to derive combo GST from combo.product.hsn if available
          const comboGst = (combo.product as any)?.hsn?.gstRate ?? 0;
          const lineTax = Math.round((lineTotal * comboGst) / 100);
          amountNum += lineTotal + lineTax;
          taxesNum += lineTax;
          continue;
        }

        // otherwise split price proportionally to components (same approach as mapper)
        for (const ci of itemsArr) {
          const qtyPerCombo = Number(ci.quantity ?? 1);
          const totalQty = qtyPerCombo * combosOrdered;
          const compPricePerUnit =
            totalUnitsPerCombo > 0
              ? Math.round(
                  (comboPricePerCombo * qtyPerCombo) / totalUnitsPerCombo,
                )
              : 0;

          // combo components are treated as already-discounted (no per-variant discount)
          const compLineSub = compPricePerUnit * totalQty;
          const compGst =
            (ci.productVariant?.product as any)?.hsn?.gstRate ?? 0;
          const compTax = Math.round((compLineSub * (compGst ?? 0)) / 100);

          amountNum += compLineSub + compTax;
          taxesNum += compTax;
        }
      } else {
        // non-combo single variant
        const unitPrice = Number(priceRec.price ?? 0);
        const qty = qtyOrdered;

        const variantObj = priceRec.productVariant;
        const variantDiscountPct = Number(variantObj?.discountPercentage ?? 0);

        const gross = unitPrice * qty;
        const lineVariantDiscount = Math.round(
          (gross * variantDiscountPct) / 100,
        );
        // GST uses product.hsn.gstRate when available (we compute tax on price*qty; if you prefer post-discount tax, adjust)
        const gstPct = (variantObj?.product as any)?.hsn?.gstRate ?? 0;
        const lineTax = Math.round((gross * (gstPct ?? 0)) / 100);

        amountNum += gross - lineVariantDiscount + lineTax;
        taxesNum += lineTax;
      }
    }

    // attach numeric fields (you can change to String if you prefer)
    return {
      ...sh,
      amount: Math.round(amountNum * 100) / 100, // round to 2 decimals
      taxes: Math.round(taxesNum * 100) / 100,
    };
  });

  return {
    meta: { total, page, limit: take },
    data: dataWithAmount,
  };
};

const getShipmentById = async (id: string) => {
  const item = await prisma.shipment.findUnique({ where: { id } });
  return item;
};

const getShipmentsByOrderId = async (orderId: string) => {
  const list = await prisma.shipment.findMany({ where: { orderId } });
  return list;
};

const updateShipment = async (
  id: string,
  payload: Partial<Prisma.ShipmentUpdateInput>,
) => {
  const shipment = await prisma.shipment.update({
    where: { id },
    data: payload as any,
  });
  return shipment;
};

const deleteShipment = async (id: string) => {
  await prisma.shipment.delete({ where: { id } });
  return { id };
};

// optional: list returns-only
const getReturnShipments = async (
  filters: ShipmentFilters,
  options: PaginationOptions,
) => {
  filters.isReturn = "true";
  return getPaginatedShipments(filters, options);
};

const shipmentStats = async () => {
  const deliveredStatuses = ["DELIVERED", "RETURN_DELIVERED"];
  const exceptionStatuses = ["PICKUP_FAILED", "UNDELIVERED"];
  const inTransitStatuses = [
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "OUT_FOR_PICKUP",
    "RETURN_IN_TRANSIT",
    "RETURN_PICKED_UP",
    "ON_HOLD",
    "PICKUP_SCHEDULED",
    "PICKUP_RESCHEDULED",
    "PICKUP_DELAYED",
  ];
  const [total, delivered, exceptions, inTransit] = await Promise.all([
    prisma.shipment.count({}),
    prisma.shipment.count({
      where: {
        OR: [
          { trackingStatus: { in: deliveredStatuses } },
          { status: { in: deliveredStatuses } },
        ],
      },
    }),
    prisma.shipment.count({
      where: {
        OR: [
          { trackingStatus: { in: exceptionStatuses } },
          { status: { in: exceptionStatuses } },
        ],
      },
    }),
    prisma.shipment.count({
      where: {
        OR: [
          { trackingStatus: { in: inTransitStatuses } },
          { status: { in: inTransitStatuses } },
        ],
      },
    }),
  ]);

  return { total, inTransit, delivered, exceptions };
};

const shipmentService = {
  getPaginatedShipments,
  getShipmentById,
  getShipmentsByOrderId,
  updateShipment,
  deleteShipment,
  getReturnShipments,
  shipmentStats,
};

export default shipmentService;
