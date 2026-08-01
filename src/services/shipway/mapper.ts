// src/services/shipway/mapper.ts
import prisma from "@/config/prisma";
import {
  Address,
  ComboItem,
  CustomerProfile,
  Order,
  OrderItem,
  Price,
  Product,
  ProductCombo,
  ProductVariant,
  Shipment,
  User,
  Variant,
  VendorProfile,
  Warehouse,
} from "@/generated/prisma";
import ApiError from "@/utils/ApiError";
import { z } from "zod";
import { status as httpStatus } from "http-status";
import shipwayService from "./shipway.service";

export type PayloadItem = {
  orderItemId: string;
  quantity: number;
  price?: number;
  name?: string | null;
  sku?: string | undefined;
  productVariantId?: string;
  priceId?: string;
};

type OrderWithRelations = Order & {
  createdBy: { user: { name?: string | null; email: string; phone?: string } };
  address: Address;
  items: (OrderItem & {
    price?: Price & {
      productVariant?: ProductVariant & { product?: Product };
      productCombo?: ProductCombo & {
        product?: Product;
        items?: {
          id: string;
          productVariant?: ProductVariant;
          quantity?: number;
        }[];
      };
    };
  })[];
};

function buildProductDisplayName(
  productName?: string | null,
  variantName?: string | null,
): string {
  if (!productName) return variantName ?? "Unknown Product";
  if (!variantName) return productName;
  // Avoid duplicates like "Coca Cola - Coca Cola"
  if (variantName.toLowerCase().includes(productName.toLowerCase()))
    return productName;
  return `${productName} - ${variantName}`;
}

/**
 * buildShipwayPayload (prorates coupon across shipments; preserves combo expansion & per-line GST)
 */
export default async function buildShipwayPayload({
  order,
  vendor,
  warehouseId,
  items,
  totalShipmentWeight,
  // optional control options:
  options,
}: {
  order: OrderWithRelations;
  vendor: VendorProfile | null;
  warehouseId: string | null;
  items: PayloadItem[];
  totalShipmentWeight: number;
  options?: {
    // mark the chunk as final to absorb rounding remainder
    isLastChunk?: boolean;
    // amount of coupon already allocated to previous chunks (integer rupees)
    previousAllocatedCoupon?: number;
    // amount of shipping already allocated to previous chunks (integer rupees)
    previousAllocatedShipping?: number;
  };
}) {
  options = options ?? {};
  const isLastChunk = !!options.isLastChunk;
  const previousAllocatedCoupon = Math.max(
    0,
    Number(options.previousAllocatedCoupon ?? 0),
  );

  const previousAllocatedShipping = Math.max(
    0,
    Number(options.previousAllocatedShipping ?? 0),
  );

  // --- Helper: compute total shipping cost for order using company rules ---
  async function computeFullShippingForOrder(
    ord: OrderWithRelations,
  ): Promise<number> {
    const companyInfo = await prisma.companyInfo.findFirst();
    if (!companyInfo) return 0;

    const customerProfileId =
      (ord.createdById as string) ?? (ord?.createdById as string) ?? undefined;

    let shippingCost = 0;

    if (customerProfileId) {
      const otherOrdersCount = await prisma.order.count({
        where: {
          createdById: customerProfileId,
          id: { not: ord.id },
        },
      });

      const isFirstOrder = otherOrdersCount === 0;

      if (companyInfo.firstOrderFreeShipping && isFirstOrder) {
        shippingCost = 0;
      } else if ((ord.subtotal ?? 0) <= companyInfo.shippingCostThreshold) {
        shippingCost = companyInfo.standardShippingCost ?? 0;
      } else {
        shippingCost = 0;
      }
    } else if ((ord.subtotal ?? 0) <= companyInfo.shippingCostThreshold) {
      shippingCost = companyInfo.standardShippingCost ?? 0;
    } else {
      shippingCost = 0;
    }

    return Math.max(0, Math.round(Number(shippingCost)));
  }

  // --- Enrich items (unchanged, small addition: we preserve variantHsnGstRate) ---
  const enriched = await Promise.all(
    items.map(async (it) => {
      if (it.price !== undefined && it.name && it.sku) {
        const orderItem = await prisma.orderItem.findUnique({
          where: { id: it.orderItemId },
          select: { quantity: true, priceId: true },
        });

        // try to fetch variant discount if possible
        let variantDiscountPercentage = 0;
        const variantIdFromPayload =
          (it as any).productVariantId ?? (it as any).sku ?? undefined;
        if (variantIdFromPayload) {
          try {
            const pv = await prisma.productVariant.findUnique({
              where: { id: String(variantIdFromPayload) },
              select: { discountPercentage: true },
            });
            if (pv && typeof pv.discountPercentage === "number")
              variantDiscountPercentage = pv.discountPercentage;
          } catch (e) {
            console.warn(
              `buildShipwayPayload: failed to fetch variant ${variantIdFromPayload} discount:`,
              e,
            );
          }
        }

        return {
          ...it,
          originalOrderQty: orderItem?.quantity ?? undefined,
          orderItemPriceId: orderItem?.priceId ?? undefined,
          variantDiscountPercentage,
        } as any;
      }

      const orderItem = await prisma.orderItem.findUnique({
        where: { id: it.orderItemId },
        include: {
          price: {
            include: {
              productVariant: {
                include: { product: { include: { hsn: true } } },
              },
              productCombo: true,
            },
          },
        },
      });

      if (orderItem && orderItem.price) {
        const pr = orderItem.price as Price & {
          productVariant?: ProductVariant & {
            product?: Product & { hsn?: { gstRate?: number } };
          };
          productCombo?: { id?: string; name?: string } | null;
        };
        const unitPrice = pr.price ?? 0;
        const variant = pr.productVariant ?? null;
        const nameFromProduct =
          pr.productCombo?.name ??
          variant?.product?.name ??
          variant?.id ??
          "Item";
        const skuFromVariant = pr.productCombo?.id ?? variant?.id ?? "sku";

        return {
          orderItemId: it.orderItemId,
          quantity: it.quantity,
          price: unitPrice,
          name: nameFromProduct,
          sku: skuFromVariant,
          productVariantId: variant?.id ?? undefined,
          originalOrderQty: orderItem.quantity,
          isComboPrice: !!pr.productCombo,
          productComboId: pr.productCombo?.id ?? undefined,
          variantDiscountPercentage: variant?.discountPercentage ?? 0,
          variantHsnGstRate:
            (variant?.product as any)?.hsn?.gstRate ?? undefined,
          variantDisplayName: (variant as any)?.variant?.name ?? undefined,
        } as any;
      }

      if (it.productVariantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: it.productVariantId },
          include: { product: { include: { hsn: true } } },
        });
        return {
          orderItemId: it.orderItemId,
          quantity: it.quantity,
          price: 0,
          name: variant?.product?.name ?? variant?.id ?? "Item",
          sku: variant?.id ?? "sku",
          productVariantId: it.productVariantId,
          variantDiscountPercentage: variant?.discountPercentage ?? 0,
          variantHsnGstRate:
            (variant?.product as any)?.hsn?.gstRate ?? undefined,
          variantDisplayName: (variant as any)?.variant?.name ?? undefined,
        };
      }

      return {
        orderItemId: it.orderItemId,
        quantity: it.quantity,
        price: 0,
        name: it.name ?? "Item",
        sku: it.sku ?? "sku",
        variantDiscountPercentage: 0,
      };
    }),
  );

  // Group by orderItemId
  const grouped = new Map<string, (typeof enriched)[0][]>();
  for (const e of enriched) {
    const arr = grouped.get(e.orderItemId) ?? [];
    arr.push(e);
    grouped.set(e.orderItemId, arr);
  }

  // Build `lines` (same expansion rules as before)
  type Line = {
    product: string;
    sku: string;
    priceNum: number;
    qty: number;
    variantDiscountPct: number;
    gstRatePct?: number;
    meta?: any;
  };
  const lines: Line[] = [];

  for (const [orderItemId, arr] of grouped.entries()) {
    const comboRow = arr.find(
      (a) => (a as any).isComboPrice || (a as any).productComboId,
    );

    if (
      comboRow &&
      comboRow.originalOrderQty !== undefined &&
      comboRow.productComboId
    ) {
      const combo = await prisma.productCombo.findUnique({
        where: { id: comboRow.productComboId },
        include: {
          items: {
            include: {
              productVariant: {
                include: { product: { include: { hsn: true } }, variant: true },
              },
            },
          },
        },
      });

      if (!combo || !combo.items || combo.items.length === 0) {
        lines.push({
          product: comboRow.name ?? "Combo",
          sku: comboRow.sku ?? comboRow.productComboId ?? "combo",
          priceNum: Number(comboRow.price ?? 0),
          qty: Number(comboRow.originalOrderQty ?? 1),
          variantDiscountPct: 0,
          gstRatePct: 0,
          meta: { isComboFallback: true },
        });
        continue;
      }

      const composition = (combo.items ?? []).map((ci: any) => ({
        variant: ci.productVariant,
        qtyPerCombo: ci.quantity ?? 1,
      }));

      // CASE A: chunk already contains expanded component rows (allocator already expanded)
      const arrHasComponentRows = arr.some(
        (a) => !!(a as any).productVariantId,
      );

      let combosToProcess = Number(comboRow.originalOrderQty ?? 1);

      if (arrHasComponentRows) {
        // Compute combos present in this chunk using component counts
        const rowsForOrderItem = arr as any[]; // items in the chunk for this orderItemId
        const compCounts: number[] = [];
        for (const comp of composition) {
          const vid = comp.variant?.id;
          const qtyPerCombo = Math.max(1, Math.floor(comp.qtyPerCombo ?? 1));
          const sumForThisComp = rowsForOrderItem.reduce(
            (s, r) =>
              s +
              (r.productVariantId === vid
                ? Number(r.quantity ?? r.qty ?? 0)
                : 0),
            0,
          );
          compCounts.push(Math.floor(sumForThisComp / qtyPerCombo));
        }
        combosToProcess =
          compCounts.length > 0 ? Math.max(0, Math.min(...compCounts)) : 0;

        // If combosToProcess is zero for some reason, fallback to originalOrderQty
        if (combosToProcess <= 0)
          combosToProcess = Number(comboRow.originalOrderQty ?? 1);
      } else {
        // CASE B: chunk has no component rows; treat like earlier and expand originalOrderQty
        combosToProcess = Number(comboRow.originalOrderQty ?? 1);
      }

      // If combosToProcess is 0, skip (shouldn't happen after checks, but guard anyway)
      if (combosToProcess <= 0) continue;

      const combosOrdered = combosToProcess;
      const totalUnitsPerCombo = composition.reduce(
        (s: number, c: any) => s + (c.qtyPerCombo ?? 1),
        0,
      );
      const comboPrice = Number(comboRow.price ?? 0);
      const desiredTotal = comboPrice * combosOrdered;

      // compute float totals per component for combosOrdered
      const componentFloats = composition.map((c) =>
        totalUnitsPerCombo > 0
          ? (comboPrice * (c.qtyPerCombo * combosOrdered)) / totalUnitsPerCombo
          : 0,
      );

      // round component totals and assign remainder to last component
      const componentTotals: number[] = [];
      let runningTotal = 0;
      for (let i = 0; i < componentFloats.length; i++) {
        if (i < componentFloats.length - 1) {
          const rounded = Math.round(componentFloats[i]);
          componentTotals.push(rounded);
          runningTotal += rounded;
        } else {
          const lastTotal = Math.max(0, desiredTotal - runningTotal);
          componentTotals.push(lastTotal);
          runningTotal += lastTotal;
        }
      }

      // Derive per-unit prices. For intermediate ones use floor; last absorbs remainder.
      let accumulatedUnitsTotal = 0;
      for (let i = 0; i < composition.length; i++) {
        const c = composition[i];
        const totalQty = (c.qtyPerCombo ?? 1) * combosOrdered;
        const compTotal = componentTotals[i] ?? 0;
        const gstRatePct =
          ((c.variant as any)?.product as any)?.hsn?.gstRate ?? 0;

        if (i < composition.length - 1) {
          const unitPrice = totalQty > 0 ? Math.floor(compTotal / totalQty) : 0;
          accumulatedUnitsTotal += unitPrice * totalQty;

          lines.push({
            product: buildProductDisplayName(
              (c.variant as any)?.product?.name,
              (c.variant as any)?.variant?.name,
            ),
            sku: (c.variant as any)?.id ?? "variant",
            priceNum: unitPrice,
            qty: totalQty,
            variantDiscountPct: 0,
            gstRatePct,
            meta: {
              fromComboId: combo.id,
              comboPricePerCombo: comboPrice,
              variantName: (c.variant as any)?.variant?.name ?? undefined,
            },
          });
        } else {
          const remaining = Math.max(0, desiredTotal - accumulatedUnitsTotal);
          const unitPrice = totalQty > 0 ? Math.round(remaining / totalQty) : 0;

          lines.push({
            product: buildProductDisplayName(
              (c.variant as any)?.product?.name,
              (c.variant as any)?.variant?.name,
            ),
            sku: (c.variant as any)?.id ?? "variant",
            priceNum: unitPrice,
            qty: totalQty,
            variantDiscountPct: 0,
            gstRatePct,
            meta: {
              fromComboId: combo.id,
              comboPricePerCombo: comboPrice,
              variantName: (c.variant as any)?.variant?.name ?? undefined,
            },
          });
        }
      }

      continue;
    }

    for (const d of arr) {
      let gstRatePct: number | undefined = (d as any).variantHsnGstRate;
      const variantNameFromD =
        (d as any).variantDisplayName ??
        (d as any).variant?.name ??
        (d as any).variantName ??
        undefined;

      const productDisplay = buildProductDisplayName(
        d.name ?? "Item",
        variantNameFromD,
      );
      if (
        (gstRatePct === undefined || gstRatePct === 0) &&
        d.productVariantId
      ) {
        try {
          const pv = await prisma.productVariant.findUnique({
            where: { id: d.productVariantId },
            include: {
              product: {
                include: {
                  hsn: true, // <-- correct include syntax
                },
              },
              variant: true,
            },
          });
          gstRatePct = pv?.product?.hsn?.gstRate ?? 0;
        } catch (e) {
          console.warn("Failed to fetch GST rate for", d.productVariantId, e);
          gstRatePct = 0;
        }
      }

      lines.push({
        product: productDisplay,
        sku: d.sku ?? "sku",
        priceNum: Number(d.price ?? 0),
        qty: Number(d.quantity ?? 0),
        variantDiscountPct: Number(d.variantDiscountPercentage ?? 0),
        gstRatePct: gstRatePct ?? 0,
        meta: { orderItemId: d.orderItemId, variantName: variantNameFromD },
      });
    }
  }

  // Compute local itemsTotal and per-line discounts & taxes
  let itemsTotal = 0;
  for (const L of lines) itemsTotal += L.priceNum * L.qty;

  // Compute per-line variant discounts and taxes **on the net amount (after discount)**
  const lineVariantDiscounts: number[] = [];
  const lineTaxes: number[] = [];

  for (const L of lines) {
    // calculate the per-line discount (integer, rounded)
    const lineDiscount = Math.round(
      (L.priceNum * L.qty * (L.variantDiscountPct ?? 0)) / 100,
    );
    lineVariantDiscounts.push(lineDiscount);

    // taxable amount = gross - discount (never negative)
    const taxableAmount = Math.max(0, L.priceNum * L.qty - lineDiscount);

    // compute tax on taxableAmount
    const lineTax = Math.round((taxableAmount * (L.gstRatePct ?? 0)) / 100);
    lineTaxes.push(lineTax);
  }

  const totalVariantDiscount = lineVariantDiscounts.reduce((a, b) => a + b, 0);
  const totalTaxes = lineTaxes.reduce((a, b) => a + b, 0);

  // ------------------- PROPORTIONAL COUPON ALLOCATION -------------------
  // Build a full-order expanded total using the same expansion rules so prorating is consistent.
  // We do not re-query DB here — we try to use order.items already included in "order".
  // If order.items do not include full combo composition you may need to fetch it.
  function expandOrderItemsToLinesFromOrder(
    orderParam: OrderWithRelations,
  ): { priceNum: number; qty: number }[] {
    const out: { priceNum: number; qty: number }[] = [];

    for (const oi of orderParam.items ?? []) {
      const pr = oi.price ?? null;
      const pv = pr?.productVariant ?? null;
      const combo = pr?.productCombo ?? null;

      if (combo && (combo as any).items && (combo as any).items.length > 0) {
        // combo expansion (use composition from order.price.productCombo.items if available)
        const comboItems = (combo as any).items as any[];
        const combosOrdered = oi.quantity ?? 1;
        const composition = comboItems.map((ci: any) => ({
          qtyPerCombo: ci.quantity ?? 1,
        }));
        const totalUnitsPerCombo = composition.reduce(
          (s, ci) => s + (ci.qtyPerCombo ?? 1),
          0,
        );
        const comboPrice = Number(pr?.price ?? 0);
        const desiredTotal = comboPrice * combosOrdered;

        // compute float totals per component for combosOrdered
        const componentFloats = composition.map((c) =>
          totalUnitsPerCombo > 0
            ? (comboPrice * (c.qtyPerCombo * combosOrdered)) /
              totalUnitsPerCombo
            : 0,
        );

        // round and assign remainder to last
        const componentTotals: number[] = [];
        let runningTotal = 0;
        for (let i = 0; i < componentFloats.length; i++) {
          if (i < componentFloats.length - 1) {
            const rounded = Math.round(componentFloats[i]);
            componentTotals.push(rounded);
            runningTotal += rounded;
          } else {
            const lastTotal = Math.max(0, desiredTotal - runningTotal);
            componentTotals.push(lastTotal);
            runningTotal += lastTotal;
          }
        }

        // convert totals to per-unit price and push
        let accumulated = 0;
        for (let i = 0; i < composition.length; i++) {
          const qtyPerCombo = composition[i].qtyPerCombo ?? 1;
          const totalQty = qtyPerCombo * combosOrdered;
          const compTotal = componentTotals[i] ?? 0;

          if (i < composition.length - 1) {
            const unitPrice =
              totalQty > 0 ? Math.floor(compTotal / totalQty) : 0;
            accumulated += unitPrice * totalQty;
            out.push({ priceNum: unitPrice, qty: totalQty });
          } else {
            const remaining = Math.max(0, desiredTotal - accumulated);
            const unitPrice =
              totalQty > 0 ? Math.round(remaining / totalQty) : 0;
            out.push({ priceNum: unitPrice, qty: totalQty });
          }
        }
      } else {
        // simple variant line
        out.push({
          priceNum: Number(pr?.price ?? 0),
          qty: Number(oi.quantity ?? 0),
        });
      }
    }
    return out;
  }

  const expandedFullOrderLines = expandOrderItemsToLinesFromOrder(order);
  const fullItemsTotal = expandedFullOrderLines.reduce(
    (s, e) => s + e.priceNum * e.qty,
    0,
  );

  const couponDiscountTotal = Math.round(
    Number(order.couponDiscount ?? 0) || 0,
  );
  let thisShipmentCoupon = 0;

  if (couponDiscountTotal <= 0 || fullItemsTotal <= 0) {
    thisShipmentCoupon = 0;
  } else {
    // proportional raw share
    const rawShare = (itemsTotal / fullItemsTotal) * couponDiscountTotal;
    const prorated = Math.round(rawShare);

    if (isLastChunk) {
      // last chunk should absorb remainder to ensure total matches exactly
      const remainder = couponDiscountTotal - previousAllocatedCoupon;
      // If remainder negative or zero, clamp to 0
      thisShipmentCoupon = Math.max(0, remainder);
    } else {
      thisShipmentCoupon = Math.max(0, prorated);
    }
  }

  // ------------------- end coupon allocation -------------------

  // --- Shipping allocation (proportional like coupon) ---
  const fullShippingCost = await computeFullShippingForOrder(order);
  let thisShipmentShipping = 0;
  if (fullShippingCost <= 0 || fullItemsTotal <= 0) {
    thisShipmentShipping = 0;
  } else {
    const rawShare = (itemsTotal / fullItemsTotal) * fullShippingCost;
    const prorated = Math.round(rawShare);
    if (isLastChunk) {
      const remainder = fullShippingCost - previousAllocatedShipping;
      thisShipmentShipping = Math.max(0, remainder);
    } else {
      thisShipmentShipping = Math.max(0, prorated);
    }
  }

  const shipping = thisShipmentShipping;
  const gift_card_amt = 0;

  // Final order total for this payload: itemsTotal - variant discounts - thisShipmentCoupon + shipping + taxes
  const orderTotalNum = Math.round(
    itemsTotal -
      totalVariantDiscount -
      thisShipmentCoupon +
      shipping +
      totalTaxes -
      gift_card_amt,
  );

  // Build products array (attach per-line discount & tax)
  const products: Array<Record<string, unknown>> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const L = lines[i];
    const lineVariantDiscount = lineVariantDiscounts[i] ?? 0;
    const lineTax = lineTaxes[i] ?? 0;

    products.push({
      product: L.product,
      price: String(Math.round(L.priceNum)),
      product_code: L.sku,
      amount: String(L.qty),
      product_quantity: String(L.qty),
      discount: String(lineVariantDiscount),
      tax_amount: String(lineTax),
      tax_rate: String(L.gstRatePct ?? 0),
      tax_title: "GST",
    });
  }

  // Usage (place before payload creation)
  const totalWeightGrams = totalShipmentWeight;

  // Prepare final payload-level values
  const discountTotalForPayload = String(thisShipmentCoupon); // prorated coupon for this shipment
  const taxes = String(totalTaxes);
  const order_total = String(orderTotalNum);
  const shippingStr = String(shipping);
  const gift_card_amt_str = String(gift_card_amt);

  // Billing/shipping info (unchanged)
  const consignee = order.createdBy?.user;
  const addr = order.address;

  const billing_address = addr?.address ?? "";
  const billing_address2 = addr?.streetNumber ?? "";
  const billing_city = addr?.city ?? "";
  const billing_state = addr?.state ?? "";
  const billing_country = addr?.country ?? "India";
  const billing_firstname = consignee?.name ?? consignee?.email ?? "Customer";
  const billing_lastname = "";
  const billing_phone = consignee?.phone ?? "";
  const billing_zipcode = addr?.zipcode ?? "";
  const billing_latitude = addr?.lat?.toString() ?? "";
  const billing_longitude = addr?.lng?.toString() ?? "";

  const shipping_address = billing_address;
  const shipping_address2 = billing_address2;
  const shipping_city = billing_city;
  const shipping_state = billing_state;
  const shipping_country = billing_country;
  const shipping_firstname = billing_firstname;
  const shipping_lastname = billing_lastname;
  const shipping_phone = billing_phone;
  const shipping_zipcode = billing_zipcode;
  const shipping_latitude = billing_latitude;
  const shipping_longitude = billing_longitude;

  // Warehouse mapping
  let shipwayWarehouseId: string | null = null;
  if (warehouseId) {
    const wh = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (wh) shipwayWarehouseId = wh.shipwayWarehouseId ?? wh.id;
  }

  const payment_type = order.paymentType === "ONLINE" ? "P" : "C";
  const order_id = `${order.id}-${vendor?.id ?? "vendor"}`.slice(0, 80);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const d = new Date(order.createdAt);
  const order_date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds(),
  )}`;

  const payload: Record<string, any> = {
    order_id,
    carrier_id: 0,
    warehouse_id: shipwayWarehouseId ?? undefined,
    return_warehouse_id: shipwayWarehouseId ?? undefined,
    products,
    discount: discountTotalForPayload,
    shipping: shippingStr,
    order_total,
    gift_card_amt: gift_card_amt_str,
    taxes,
    payment_type,
    // email: consignee?.email ?? "",
    billing_address,
    billing_address2,
    billing_city,
    billing_state,
    billing_country,
    billing_firstname,
    billing_lastname,
    billing_phone,
    billing_zipcode,
    billing_latitude,
    billing_longitude,
    shipping_address,
    shipping_address2,
    shipping_city,
    shipping_state,
    shipping_country,
    shipping_firstname,
    shipping_lastname,
    shipping_phone,
    shipping_zipcode,
    shipping_latitude,
    shipping_longitude,
    order_date,
    order_weight: totalWeightGrams?.toString() ?? "0",
  };

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });

  console.log("Built Shipway payload:", payload);

  return {
    payload,
    shippingUsed: thisShipmentShipping,
    couponUsed: thisShipmentCoupon,
  };
}

/** ******************* MAPPER FOR RETURN SHIPMENT ************************* */
// mapReturnsByShipmentWithProfilesToShipwayPayloads.typed.ts

/* ---------------- Zod - frontend minimal payload ---------------- */
const FrontProductSchema = z.object({
  sku: z.string(), // productVariant.id OR productCombo.id
  returnQty: z.number().int().positive(),
  returnReasonId: z.string().optional(), // existing Shipway id
  returnReason: z.string().optional(),
  customerNotes: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  desiredExchangeSku: z.string().optional(),

  // 🔹 new fields for combo
  isCombo: z.boolean().optional(),
  comboComposition: z
    .array(
      z.object({
        variantId: z.string().optional(),
        qtyPerCombo: z.number().int().positive(),
      }),
    )
    .optional(),
});

const TransferDetailsSchema = z.record(z.any());

const FrontendReturnRequestSchema = z.object({
  orderId: z.string(), // internal order.id
  shipwayHandlesRefund: z.boolean().optional(), // new flag to indicate if Shipway should process refund
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  products: z.array(FrontProductSchema).min(1),
  returnType: z.enum(["exchange", "refund"]).optional(),
  // Refund-specific fields
  refundPaymentId: z.number().int().optional(),
  transferDetails: TransferDetailsSchema.optional(),
  orderDate: z.string().optional(),
  carrierId: z.string().optional(),
  returnWarehouseId: z.string().optional(),
  order_weight: z.number().optional(),
});

type FrontProduct = z.infer<typeof FrontProductSchema>;
type FrontendReturnRequest = z.infer<typeof FrontendReturnRequestSchema>;

/* ---------------- Prisma-inferred composed types ----------------
 We want typed results for the `order` query including nested relations.
------------------------------------------------------------------*/
type PriceWithVariant = Price & {
  productVariant?:
    | (ProductVariant & {
        product?: Product | null;
        // optional variant meta (if you have a Variant model)
        variant?: Variant | null;
      })
    | null;
  // NEW: productCombo relation (when price references a combination product)
  productCombo?:
    | (ProductCombo & {
        product?: Product | null; // the Product that owns the combo (optional)
        // include ComboItem(s) so mapper/logic can inspect variant composition
        items?: (ComboItem & {
          productVariant?: ProductVariant | null;
        })[];
      })
    | null;
};

type OrderItemWithPrice = OrderItem & {
  price?: PriceWithVariant | null;
};

type ReturnOrderWithRelations = Order & {
  items: OrderItemWithPrice[];
  address?: Address | null;
  createdBy?:
    | (CustomerProfile & {
        user?: User | null;
        addresses?: Address[] | null;
      })
    | null;
};

/* ---------------- small helper to choose product_code ---------------- */
function getProductCodeFromVariant(
  variant: ProductVariant | undefined | null,
): string | null {
  // Prefer explicit SKU if you add it: (variant as any).sku ?? variant?.id
  // As Prisma model doesn't include `sku` in your schema, prefer id
  // eslint-disable-next-line
  return variant?.id ?? variant?.variantId ?? null;
}

/* ---------------- Refund validation helpers ---------------- */
const REFUND_PAYMENT_MODES: Record<number, string> = {
  1: "Bank Account",
  2: "UPI",
  3: "Paytm",
  4: "Gift Card",
  5: "Store Credits",
  6: "Original Payment Method",
};

function validateTransferDetailsForPaymentMode(
  paymentId: number,
  details: Record<string, unknown> | undefined,
) {
  if (!details || typeof details !== "object") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `transferDetails is required for refund_payment_id=${paymentId} (${REFUND_PAYMENT_MODES[paymentId]})`,
    );
  }

  const has = (k: string) => Object.prototype.hasOwnProperty.call(details, k);

  switch (paymentId) {
    case 1: // Bank Account
      if (
        !has("account_type") ||
        !has("ifsc_code") ||
        !has("beneficiary_name") ||
        !has("bank_name") ||
        !has("account_number") ||
        !has("phone")
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for Bank Account must include: { account_type, ifsc_code, beneficiary_name, bank_name, account_number, phone }",
        );
      }
      break;

    case 2: // UPI
      if (!has("upi_id") && !has("upi_vpa")) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for UPI must include either `upi_id` or `upi_vpa`",
        );
      }
      break;

    case 3: // Paytm
      if (!has("paytm_number") && !has("paytm_vpa")) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for Paytm must include `paytm_number` or `paytm_vpa`",
        );
      }
      break;

    case 4: // Gift Card
      if (
        !has("gift_card_code") &&
        !(has("gift_card_amount") && has("gift_card_issuer"))
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for Gift Card must include `gift_card_code` or `{ gift_card_amount, gift_card_issuer }`",
        );
      }
      break;

    case 5: // Store Credits
      if (!has("customer_id") && !has("account_id")) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for Store Credits must include `customer_id` or `account_id`",
        );
      }
      if (!has("amount")) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for Store Credits must include `amount`",
        );
      }
      break;

    case 6: // Original Payment Method
      if (!has("original_payment_id") && !has("original_txn_id")) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "transferDetails for Original Payment Method refund must include `original_payment_id` or `original_txn_id`",
        );
      }
      break;

    default:
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Unsupported refund_payment_id: ${paymentId}`,
      );
  }
}

/**
 * mapReturnsByShipmentWithProfilesToShipwayPayloads
 *
 * Assumes the following are in scope:
 *  - prisma
 *  - shipwayService
 *  - FrontendReturnRequestSchema, FrontProduct
 *  - getProductCodeFromVariant
 *  - ApiError, httpStatus
 *  - REFUND_PAYMENT_MODES, validateTransferDetailsForPaymentMode
 */
export async function mapReturnsByShipmentWithProfilesToShipwayPayloads(
  frontendPayload: FrontProduct,
): Promise<
  Array<{
    shipwayOrderId: string;
    payload: Record<string, unknown>;
    orderItemIds?: string[];
  }>
> {
  const parsed = FrontendReturnRequestSchema.parse(frontendPayload);
  const {
    orderId,
    contact,
    products: requestedProducts,
    returnType,
    refundPaymentId,
    transferDetails,
    orderDate,
    carrierId,
    returnWarehouseId,
    order_weight,
  } = parsed;

  // Resolve textual return reasons to external ids via shipwayService if provided
  for (const rp of requestedProducts) {
    if (!rp.returnReasonId && (rp as any).returnReason) {
      const reasonText = (rp as any).returnReason.trim();
      if (reasonText) {
        const externalId =
          await shipwayService.ensureReturnReasonExists(reasonText);
        if (!externalId) {
          throw new ApiError(
            httpStatus.BAD_GATEWAY,
            `Could not resolve return reason: "${reasonText}"`,
          );
        }
        rp.returnReasonId = externalId;
      }
    }
  }

  const shipwayHandlesRefund = (parsed as any)?.shipwayHandlesRefund === true;

  // if (returnType === "refund" && shipwayHandlesRefund) {
  //   if (typeof refundPaymentId !== "number") {
  //     throw new ApiError(
  //       httpStatus.BAD_REQUEST,
  //       "refundPaymentId is required when Shipway is expected to perform the refund.",
  //     );
  //   }
  //   if (
  //     !Object.prototype.hasOwnProperty.call(
  //       REFUND_PAYMENT_MODES,
  //       refundPaymentId,
  //     )
  //   ) {
  //     throw new ApiError(
  //       httpStatus.BAD_REQUEST,
  //       `refundPaymentId ${refundPaymentId} is invalid.`,
  //     );
  //   }
  //   validateTransferDetailsForPaymentMode(
  //     refundPaymentId,
  //     transferDetails as Record<string, unknown> | undefined,
  //   );
  // }

  // Load order + shipments. We include nested price/variant/combo as before, but we will batch-fetch HSN/variant metadata later.
  const order = (await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          price: {
            include: {
              productVariant: { include: { product: true, variant: true } },
              productCombo: {
                include: {
                  items: {
                    include: {
                      productVariant: {
                        include: { variant: true, product: true },
                      },
                    },
                  },
                  product: true,
                },
              },
            },
          },
        },
      },
      address: true,
      createdBy: { include: { user: true, addresses: true } },
    },
  })) as ReturnOrderWithRelations | null;

  if (!order)
    throw new ApiError(httpStatus.NOT_FOUND, `Order ${orderId} not found`);

  const shipments = (await prisma.shipment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  })) as Shipment[];

  const orderItemToShipmentMap = new Map<
    string,
    { id: string; shipwayOrderId?: string }
  >();
  for (const s of shipments) {
    const itemIds: string[] = s.orderItemIds ?? [];
    for (const itemId of itemIds) {
      if (!orderItemToShipmentMap.has(itemId) && s.shipwayOrderId) {
        orderItemToShipmentMap.set(itemId, {
          id: s.id,
          shipwayOrderId: s.shipwayOrderId,
        });
      }
    }
  }

  // Match requested products to order items
  type MatchedEntry = {
    requestProduct: FrontProduct;
    orderItem: OrderItemWithPrice;
    shipment: { id: string; shipwayOrderId: string };
    priceRecord?: PriceWithVariant | null;
    productVariant?: PriceWithVariant["productVariant"] | null;
    product?: Product | null;
    productCombo?: any | null;
  };

  const matchedEntries: MatchedEntry[] = [];

  for (const rp of requestedProducts) {
    const matchingItem = order.items.find(
      (it) =>
        it.price?.productVariant?.id === rp.sku ||
        it.price?.productCombo?.id === rp.sku,
    );
    if (!matchingItem) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `Requested product sku=${rp.sku} not found in order ${orderId}`,
      );
    }

    const shippedQty = matchingItem.quantity ?? 0;
    if (rp.returnQty > shippedQty) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `returnQty (${rp.returnQty}) for sku=${rp.sku} exceeds shipped qty (${shippedQty})`,
      );
    }

    const shipmentRef = orderItemToShipmentMap.get(matchingItem.id);
    if (!shipmentRef || !shipmentRef.shipwayOrderId) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `No shipment found for orderItemId=${matchingItem.id}`,
      );
    }

    const priceRecord = matchingItem.price ?? null;
    const productVariant = priceRecord?.productVariant ?? null;
    const product = productVariant?.product ?? null;
    const productCombo = (priceRecord as any)?.productCombo ?? null;

    matchedEntries.push({
      requestProduct: rp,
      orderItem: matchingItem,
      shipment: {
        id: shipmentRef.id,
        shipwayOrderId: shipmentRef.shipwayOrderId,
      },
      priceRecord,
      productVariant,
      product,
      productCombo,
    });
  }

  // Group by shipwayOrderId
  const grouped = new Map<string, MatchedEntry[]>();
  for (const e of matchedEntries) {
    const key = e.shipment.shipwayOrderId;
    const arr = grouped.get(key) ?? [];
    arr.push(e);
    grouped.set(key, arr);
  }

  // ---- BATCH: collect all variant ids we need metadata for (variants and combo components) ----
  const variantIdSet = new Set<string>();
  for (const me of matchedEntries) {
    // direct variant price
    if (me.productVariant?.id) variantIdSet.add(me.productVariant.id);

    // if productCombo present, gather component variant IDs (from DB combo or frontend composition)
    const combo = me.productCombo;
    if (combo) {
      // Prefer DB composition if available (we included it on order)
      const dbItems = (combo.items ?? []) as any[];
      for (const ci of dbItems) {
        const vid = ci?.productVariant?.id;
        if (vid) variantIdSet.add(vid);
      }
      // Also consider frontend composition if the consumer provided it (not required)
      const frontendComp = (me.requestProduct as any)?.comboComposition;
      if (Array.isArray(frontendComp)) {
        for (const fc of frontendComp) {
          const vid = fc.variantId ?? fc.productVariantId;
          if (vid) variantIdSet.add(vid);
        }
      }
    }
  }

  const variantIds = Array.from(variantIdSet);
  // Batch fetch productVariant metadata: discountPercentage and product -> hsn.gstRate
  const variantMetaRows =
    variantIds.length > 0
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { include: { hsn: true } } },
        })
      : [];

  // Build maps for quick lookup
  const variantMetaById = new Map<
    string,
    {
      discountPercentage?: number | null;
      product?: (Product & { hsn?: { gstRate?: number | null } }) | null;
    }
  >();
  for (const v of variantMetaRows) {
    variantMetaById.set(v.id, {
      discountPercentage: (v as any).discountPercentage,
      product: (v as any).product ?? null,
    });
  }

  // Build payloads grouped by shipwayOrderId
  const results: Array<{
    shipwayOrderId: string;
    payload: Record<string, unknown>;
    orderItemIds?: string[];
  }> = [];

  for (const [shipwayOrderId, entries] of grouped.entries()) {
    const shipwayProducts: Array<Record<string, unknown>> = [];
    const allOrderItemIds: string[] = [];

    for (const e of entries) {
      const rp = e.requestProduct;
      const variant = e.productVariant ?? undefined;
      const product = e.product ?? undefined;
      const combo = e.productCombo ?? undefined;

      // If this entry is a combo (priceRecord.productCombo present or frontend marked isCombo)
      if (
        combo &&
        ((combo.items && combo.items.length > 0) ||
          (rp as any).comboComposition)
      ) {
        // Compose composition list (variantId + qtyPerCombo)
        const compositionFromDb =
          combo?.items?.map((ci: any) => ({
            variantId: ci.productVariant?.id,
            qtyPerCombo: ci.quantity ?? 1,
          })) ?? [];

        const compositionFromFrontend =
          (rp as any).comboComposition ?? undefined;

        const composition =
          compositionFromFrontend && compositionFromFrontend.length > 0
            ? compositionFromFrontend.map((c: any) => ({
                variantId: c.variantId ?? c.productVariantId,
                qtyPerCombo: c.qtyPerCombo,
              }))
            : compositionFromDb;

        if (!composition || composition.length === 0) {
          // fallback: emit combo as single line
          const fallbackVariantName = variant?.variant?.name ?? null;
          const prodEntryFallback: Record<string, unknown> = {
            product: buildProductDisplayName(
              combo.name ?? product?.name ?? "Combo",
              fallbackVariantName,
            ),
            price: String(e.priceRecord?.price ?? 0),
            product_code: combo.id ?? getProductCodeFromVariant(variant) ?? "",
            amount: String(rp.returnQty),
            product_quantity: String(rp.returnQty),
            discount: "0",
            tax_rate: "0",
            tax_amount: "0",
            tax_title: "",
            return_reason_id: rp.returnReasonId ?? "0",
            return_products_images: rp.images ?? [],
            customer_notes: rp.customerNotes ?? "",
            variants: fallbackVariantName,
          };
          if (rp.desiredExchangeSku) {
            prodEntryFallback.customer_notes = `${prodEntryFallback.customer_notes} | desired_exchange: ${rp.desiredExchangeSku}`;
          }
          shipwayProducts.push(prodEntryFallback);
          allOrderItemIds.push(e.orderItem.id);
          continue;
        }

        // number of combos being returned
        const combosReturned = Number(
          rp.returnQty ?? e.orderItem.quantity ?? 1,
        );
        const comboPrice = Number(e.priceRecord?.price ?? 0);

        // compute total units per combo to split price proportionally
        const totalUnitsPerCombo = composition.reduce(
          (s: number, c: any) => s + (c.qtyPerCombo ?? 1),
          0,
        );

        // --- Build component totals for entire returned quantity (not per-unit) ---
        // desired total money to split = comboPrice * combosReturned
        const desiredTotal = comboPrice * combosReturned;

        // compute float totals for each component (for the entire combosReturned quantity)
        const componentFloats = composition.map((c: any) =>
          totalUnitsPerCombo > 0
            ? (comboPrice * (c.qtyPerCombo * combosReturned)) /
              totalUnitsPerCombo
            : 0,
        );

        // Round component totals and assign remainder to last component to ensure exact sum == desiredTotal
        const componentTotals: number[] = [];
        let runningTotal = 0;
        for (let i = 0; i < componentFloats.length; i++) {
          if (i < componentFloats.length - 1) {
            const rounded = Math.round(componentFloats[i]);
            componentTotals.push(rounded);
            runningTotal += rounded;
          } else {
            const lastTotal = Math.max(0, desiredTotal - runningTotal);
            componentTotals.push(lastTotal);
            runningTotal += lastTotal;
          }
        }

        // Now derive per-unit price for each component so (unitPrice * qty) === componentTotal
        for (let i = 0; i < composition.length; i++) {
          const comp = composition[i];
          const compVariantId = comp.variantId;
          const qtyPerCombo = comp.qtyPerCombo ?? 1;
          const totalQty = qtyPerCombo * combosReturned;
          const compTotal = componentTotals[i] ?? 0;

          // For all but last component, floor per-unit to avoid exceeding compTotal due to rounding
          // For last component, compute remaining to ensure exact equality
          let unitPriceForComponent: number;
          if (i < composition.length - 1) {
            unitPriceForComponent =
              totalQty > 0 ? Math.floor(compTotal / totalQty) : 0;
          } else {
            // last: ensure compUnitPrice * totalQty sums to compTotal (rounding by unit)
            unitPriceForComponent =
              totalQty > 0 ? Math.round(compTotal / totalQty) : 0;
          }

          // *** Combo rule: no discount applied to components (already discounted at combo level)
          const totalDiscountForLine = 0;

          // taxable amount is compTotal - totalDiscountForLine (here discount 0)
          const taxableAmount = Math.max(0, compTotal - totalDiscountForLine);

          // find GST rate from variant meta map (product.hsn.gstRate)
          const vm = compVariantId
            ? variantMetaById.get(compVariantId)
            : undefined;
          const gstRatePct = (vm?.product as any)?.hsn?.gstRate ?? 0;

          // compute tax for this component (rounded)
          const lineTax = Math.round((taxableAmount * (gstRatePct ?? 0)) / 100);

          const variantObj =
            combo?.items?.find(
              (ci: any) => ci.productVariant?.id === compVariantId,
            )?.productVariant ?? null;

          const compVariantName =
            (variantObj?.variant?.name as string | undefined) ??
            (variant?.variant?.name as string | undefined) ??
            undefined;

          const prodRow: Record<string, unknown> = {
            product: buildProductDisplayName(
              variantObj?.product?.name ??
                variant?.product?.name ??
                `Variant ${compVariantId}`,
              compVariantName ?? null,
            ),
            price: String(unitPriceForComponent),
            product_code:
              compVariantId ?? getProductCodeFromVariant(variant) ?? "",
            amount: String(totalQty),
            product_quantity: String(totalQty),
            discount: String(totalDiscountForLine), // ALWAYS 0 for combo components
            tax_rate: String(gstRatePct),
            tax_amount: String(lineTax),
            tax_title: "",
            return_reason_id: rp.returnReasonId ?? "0",
            return_products_images: rp.images ?? [],
            customer_notes: rp.customerNotes ?? "",
            variants: compVariantName,
          };

          if (rp.desiredExchangeSku) {
            prodRow.customer_notes = `${prodRow.customer_notes} | desired_exchange: ${rp.desiredExchangeSku}`;
          }

          shipwayProducts.push(prodRow);
        }

        allOrderItemIds.push(e.orderItem.id);
        continue; // next matched entry
      } // end combo branch

      // Non-combo (simple variant)
      const unitPrice = Number(e.priceRecord?.price ?? 0);
      const variantDiscountPct = (variant?.discountPercentage as number) ?? 0;

      // compute per-unit discount (rounded to integer)
      const unitDiscount = Math.round((unitPrice * variantDiscountPct) / 100);
      const qty = Number(rp.returnQty ?? 0);

      // total discount for line
      const totalDiscount = unitDiscount * qty;

      // GST: get from variant metadata map (product.hsn.gstRate) if available
      let gstRatePct = 0;
      if (variant?.id) {
        const vm = variantMetaById.get(variant.id);
        gstRatePct = (vm?.product as any)?.hsn?.gstRate ?? 0;
      } else {
        // fallback: try variant.product.hsn that might have been loaded on order
        gstRatePct = (variant?.product as any)?.hsn?.gstRate ?? 0;
      }

      // taxable amount = gross - discount
      const grossAmount = unitPrice * qty;
      const taxableAmount = Math.max(0, grossAmount - totalDiscount);

      // compute tax on taxable amount (rounded)
      const lineTax = Math.round((taxableAmount * (gstRatePct ?? 0)) / 100);

      const variantNameForRow =
        (variant?.variant?.name as string | undefined) ??
        (product as any)?.variant?.name ??
        undefined;

      const prodEntry: Record<string, unknown> = {
        product: buildProductDisplayName(
          product?.name ?? "Unknown Product",
          variantNameForRow ?? null,
        ),
        price: String(unitPrice),
        product_code: getProductCodeFromVariant(variant) ?? "",
        amount: String(qty),
        product_quantity: String(qty),
        discount: String(totalDiscount),
        tax_rate: String(gstRatePct),
        tax_amount: String(lineTax),
        tax_title: "",
        return_reason_id: rp.returnReasonId ?? "0",
        return_products_images: rp.images ?? [],
        customer_notes: rp.customerNotes ?? "",
        variants: variantNameForRow,
      };

      if (rp.desiredExchangeSku) {
        prodEntry.customer_notes += ` | desired_exchange: ${rp.desiredExchangeSku}`;
      }

      shipwayProducts.push(prodEntry);
      allOrderItemIds.push(e.orderItem.id);
    } // end entries loop

    // compute order_total = sum(price * qty) - sum(discount) + sum(tax_amount)
    let order_total_num = 0;
    let totalTaxesForPayload = 0;
    for (const p of shipwayProducts) {
      const pr = Number(p.price ?? 0) || 0;
      const qty = Number((p.amount ?? p.product_quantity) as any) || 0;
      const disc = Number(p.discount ?? 0) || 0;
      const tax = Number(p.tax_amount ?? 0) || 0;
      order_total_num += pr * qty - disc + tax;
      totalTaxesForPayload += tax;
    }

    const orderAddress = order.address ?? undefined;
    const user = order.createdBy?.user ?? undefined;
    const billing_firstname = (user?.name ?? "").split(" ")[0] ?? "";
    const billing_lastname =
      (user?.name ?? "").split(" ").slice(1).join(" ") ?? "";
    const billing_phone = contact?.phone ?? user?.phone ?? "";
    const email = contact?.email ?? user?.email ?? "";

    const billing_address = orderAddress?.address ?? "";
    const billing_address2 = orderAddress?.road ?? "";
    const billing_city = orderAddress?.city ?? "";
    const billing_state = orderAddress?.state ?? "";
    const billing_country = orderAddress?.country ?? "India";
    const billing_zipcode = orderAddress?.zipcode ?? "";

    const payload: Record<string, unknown> = {
      order_id: shipwayOrderId,
      ...(carrierId ? { carrier_id: carrierId } : {}),
      ...(returnWarehouseId ? { return_warehouse_id: returnWarehouseId } : {}),
      return_order_status: returnType === "exchange" ? "E" : "R",
      products: shipwayProducts,
      discount: String(0), // order-level discount (map order.couponDiscount here if desired)
      shipping: "0",
      order_total: String(Math.round(order_total_num)),
      gift_card_amt: "0",
      taxes: String(totalTaxesForPayload),
      payment_type: order.paymentType === "ONLINE" ? "P" : "C",
      // email,
      billing_address,
      billing_address2,
      billing_city,
      billing_state,
      billing_country,
      billing_firstname,
      billing_lastname,
      billing_phone,
      billing_zipcode,
      shipping_address: billing_address,
      shipping_address2: billing_address2,
      shipping_city: billing_city,
      shipping_state: billing_state,
      shipping_country: billing_country,
      shipping_firstname: billing_firstname,
      shipping_lastname: billing_lastname,
      shipping_phone: billing_phone,
      shipping_zipcode: billing_zipcode,
      refund_payment_id: refundPaymentId,
      transferDetails: {},
      order_weight: order_weight?.toString() ?? "0",
      // ...(returnType === "refund" &&
      // shipwayHandlesRefund &&
      // typeof refundPaymentId === "number"
      //   ? {
      //       refund_payment_id:
      //         refundPaymentId === 0 ? "0" : String(refundPaymentId),
      //       transfer_details: transferDetails ?? {},
      //     }
      //   : {}),
    };

    results.push({ shipwayOrderId, payload, orderItemIds: allOrderItemIds });
    console.log({ payload, returnType, shipwayHandlesRefund, refundPaymentId });
  }

  return results;
}
