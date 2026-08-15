// src/jobs/queueWorker.ts
import prisma from "@/config/prisma";
import {
  Address,
  ComboItem,
  Order,
  OrderItem,
  Price,
  Product,
  ProductCombo,
  ProductVariant,
} from "@/generated/prisma";
import ApiError from "@/utils/ApiError";
import { buildShipwayOrderId } from "@/utils/shipwayUtils";
// eslint-disable-next-line
import {
  Job,
  Queue,
  UNRECOVERABLE_ERROR,
  UnrecoverableError,
  Worker,
} from "bullmq";
import { status as httpStatus } from "http-status";
import buildShipwayPayload from "./mapper";
// NOTE: allocator should accept expanded combo rows (see allocator.ts changes)
import allocateAndReserve, { Chunk } from "./shipmentAllocator";
import shipwayService from "./shipway.service";

function parseRedisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: url.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        return Math.min(times * 2000, 15000);
      },
    };
  }
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      return Math.min(times * 2000, 15000);
    },
  };
}

const redisConnection = parseRedisConnection();


type PayloadItem = {
  orderItemId: string;
  quantity: number;
  price?: number;
  name?: string | null;
  sku?: string | undefined;
  productVariantId?: string;
};

/**
 * AllocatorItemExtended (worker-side shape)
 * - For normal variant items: comboGroupId, qtyPerCombo, productComboId are undefined.
 * - For expanded combo rows: comboGroupId and productComboId are set, qtyPerCombo indicates units per 1 combo.
 *
 * Note: We do not import the type from allocator to avoid circular/typing issues if allocator isn't updated yet.
 */
type AllocatorItemExtended = {
  id: string; // OrderItem id
  // For variant items: total units of that variant required
  // For combo items: number of combo units ordered (not expanded variant units)
  quantity: number;
  price?: { productVariantId?: string; productComboId?: string };
  // combo metadata (present for combo items)
  comboGroupId?: string | null; // productCombo.id when part of a combo
  qtyPerCombo?: number | null; // optional single-variant qty (not needed when comboComposition present)
  productComboId?: string | null;
  // optional composition hint (variant ids + qty per combo) to shortcut DB reads in allocator
  comboComposition?: { productVariantId: string; qtyPerCombo: number }[] | null;
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

type OrderItemWithRelations = OrderItem & {
  price?:
    | (Price & {
        productVariant?: ProductVariant & { product?: Product };
        productCombo?:
          | (ProductCombo & {
              product?: Product;
              // allow the looser shape that Prisma sometimes returns:
              items?: Array<
                | (ComboItem & {
                    productVariant?: ProductVariant | null;
                    quantity?: number;
                  })
                | {
                    id?: string;
                    productVariant?: Partial<ProductVariant> | null;
                    quantity?: number;
                  }
              >;
            })
          | null;
      })
    | null;
};

// queue + scheduler
export const pushOrderQueue = new Queue("shipway-pushOrder", {
  connection: redisConnection,
});

pushOrderQueue.on("error", (err) => {
  if (err.message.includes("ENOTFOUND")) return;
  console.warn("[BullMQ Queue Warning]", err.message);
});

// exported for other modules to use
export const enqueuePushOrder = (orderId: string) => {
  return pushOrderQueue.add(
    "push",
    { orderId },
    {
      attempts: 1,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
};

// worker (exported so tests / graceful shutdown can access it)
export const shipwayPushWorker = new Worker(
  "shipway-pushOrder",
  async (job: Job) => {
    const { orderId } = job.data as { orderId: string };

    const order = (await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        createdBy: { include: { user: true } },
        address: true,
        items: {
          include: {
            price: {
              include: {
                productVariant: { include: { product: true } },
                // productCombo composition included for combos
                productCombo: {
                  include: {
                    product: true, // helpful for vendor attribution
                    items: {
                      include: {
                        productVariant: { include: { product: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })) as OrderWithRelations | null;

    console.log("from queueWorker 127");

    if (!order) {
      // eslint-disable-next-line
      console.log(`Order not found: ${orderId}`);
      throw new UnrecoverableError(`Order not found: ${orderId}`);
    }

    // group items by vendor (product.createdById is vendor id or null for platform)
    const vendorMap = new Map<string | null, OrderItemWithRelations[]>();

    // Determine vendorId from variant.product or combo.product
    for (const it of order.items) {
      const vendorId =
        it.price?.productVariant?.product?.createdById ??
        it.price?.productCombo?.product?.createdById ??
        null;

      if (!vendorMap.has(vendorId)) vendorMap.set(vendorId, []);
      vendorMap.get(vendorId)!.push(it);
    }
    console.log("from queueWorker 155");

    // try {
    // iterate vendor groups
    for (const [vendorId, items] of vendorMap.entries()) {
      const vendor = vendorId
        ? // eslint-disable-next-line
          await prisma.vendorProfile.findUnique({
            where: { id: vendorId },
            include: { warehouses: true },
          })
        : null;

      // convert items to shape allocateAndReserve expects (expanded combo rows)
      const vendorItems: AllocatorItemExtended[] = [];

      for (const it of items) {
        const price = it.price ?? ({} as any);

        if (price.productCombo) {
          const combo = price.productCombo;

          // Defensive: ensure every combo item maps to a variant
          const rawItems = combo.items ?? [];
          const missing = rawItems.some((ci: any) => !ci.productVariant?.id);
          if (missing) {
            throw new UnrecoverableError(
              `Combo ${combo.id} composition missing productVariant mapping for orderItem ${it.id}`,
            );
          }

          // Push a single combo-level item for the allocator to handle.
          // allocator should decide whether to allocate from WarehouseComboStock (preferred)
          // or fallback to variant-level WarehouseStock (if no combo stock).
          vendorItems.push({
            id: it.id,
            quantity: it.quantity, // number of combos ordered (not expanded variant qty)
            comboGroupId: combo.id,
            productComboId: combo.id,
            // optionally include composition so allocator can avoid extra DB read:
            comboComposition: rawItems.map((ci: any) => ({
              productVariantId: ci.productVariant!.id,
              qtyPerCombo: ci.quantity ?? 1,
            })),
          } as AllocatorItemExtended & {
            comboComposition?: {
              productVariantId: string;
              qtyPerCombo: number;
            }[];
          });
        } else {
          // normal variant
          const variantId = price.productVariant?.id ?? "";
          vendorItems.push({
            id: it.id,
            quantity: it.quantity,
            price: { productVariantId: variantId },
          });
        }
      }

      // determine chunks
      // determine chunks
      let chunks: Chunk[] = [];

      if (!vendorId) {
        // platform-owned products: create a single chunk without reservation
        // vendorItems may contain:
        //  - variant rows: { id, quantity, price: { productVariantId } }
        //  - combo-level rows: { id, quantity /* combos */, productComboId, comboComposition? }
        //
        // Expand any combo-level rows into variant-level shipping lines using comboComposition.
        // If comboComposition is not present on a combo item, fetch it once from DB.
        const itemsMap = new Map<
          string,
          { qty: number; productVariantId?: string }
        >();

        // gather comboIds missing composition
        const missingComboIds = new Set<string>();
        for (const vi of vendorItems) {
          if (
            vi.productComboId &&
            (!vi.comboComposition || vi.comboComposition.length === 0)
          ) {
            missingComboIds.add(vi.productComboId);
          }
        }

        // fetch compositions for missing combos (if any)
        const comboCompositionCache = new Map<
          string,
          { productVariantId: string; qtyPerCombo: number }[]
        >();
        if (missingComboIds.size > 0) {
          const combos = await prisma.productCombo.findMany({
            where: { id: { in: Array.from(missingComboIds) } },
            include: { items: { include: { productVariant: true } } },
          });
          for (const c of combos) {
            const comp = (c.items ?? []).map((ci: any) => ({
              productVariantId: ci.productVariant?.id,
              qtyPerCombo: ci.quantity ?? 1,
            }));
            comboCompositionCache.set(c.id, comp);
          }
        }

        for (const vi of vendorItems) {
          // variant-level row (normal)
          if (!vi.productComboId && vi.price?.productVariantId) {
            const key = `${vi.id}:${vi.price.productVariantId}`;
            const existing = itemsMap.get(key);
            itemsMap.set(key, {
              qty: (existing?.qty ?? 0) + vi.quantity,
              productVariantId: vi.price.productVariantId,
            });
            continue;
          }

          // combo-level row: expand into variant-level rows for shipping
          if (vi.productComboId) {
            // prefer provided composition hint
            const composition =
              vi.comboComposition ??
              comboCompositionCache.get(vi.productComboId) ??
              [];

            if (composition.length === 0) {
              // defensive: composition is required to expand the combo for platform shipments
              throw new UnrecoverableError(
                `Missing combo composition for platform combo orderItem ${vi.id} (combo ${vi.productComboId})`,
              );
            }

            for (const comp of composition) {
              if (!comp.productVariantId) {
                throw new UnrecoverableError(
                  `Combo ${vi.productComboId} contains item with no productVariant mapping; cannot expand for orderItem ${vi.id}`,
                );
              }
              const addQty = (comp.qtyPerCombo ?? 1) * vi.quantity;
              const key = `${vi.id}:${comp.productVariantId}`;
              const existing = itemsMap.get(key);
              itemsMap.set(key, {
                qty: (existing?.qty ?? 0) + addQty,
                productVariantId: comp.productVariantId,
              });
            }
            continue;
          }

          // fallback: if a vendorItem somehow lacks both productComboId and productVariantId
          const key = `${vi.id}:${vi.price?.productVariantId ?? ""}`;
          const existing = itemsMap.get(key);
          itemsMap.set(key, {
            qty: (existing?.qty ?? 0) + vi.quantity,
            productVariantId: vi.price?.productVariantId,
          });
        }

        // build chunk items expected by downstream code
        const chunkItems = Array.from(itemsMap.entries()).map(([k, v]) => {
          const [orderItemId] = k.split(":");
          if (!v.productVariantId) {
            // Defensive: we must always have a productVariantId for shipping lines.
            // This indicates a bug earlier in the pipeline (missing composition or mapping).
            throw new UnrecoverableError(
              `Missing productVariantId when building chunk items for orderItem ${orderItemId}`,
            );
          }
          return {
            orderItemId,
            productVariantId: v.productVariantId,
            qty: v.qty,
          };
        });

        chunks = [{ warehouseId: null, items: chunkItems }];
      } else {
        // vendor-owned products: allocate & reserve stock (may throw if validation fails or concurrent conflict)
        // allocator now must accept both:
        //  - variant-level rows: { id, quantity, price: { productVariantId } }
        //  - combo-level rows:   { id, quantity /* combos */, productComboId, comboComposition? }
        // It should prefer allocating from WarehouseComboStock for combos and only fall back to variant-level stock when needed.
        // eslint-disable-next-line
        try {
          chunks = await allocateAndReserve(vendorId, vendorItems as any);
        } catch (err: any) {
          console.log("Error in Allocation : ", err);
          if (err instanceof UnrecoverableError) {
            throw err;
          }
          if (err instanceof ApiError) {
            const statusCode = err?.statusCode;
            const isPermanent =
              statusCode && statusCode >= 400 && statusCode < 500;
            if (!isPermanent) {
              throw err;
            } else {
              throw new UnrecoverableError(err?.message);
            }
          }
        }
      }

      console.log("Allocator chunks : ", JSON.stringify(chunks, null, 2));

      let previousAllocatedCoupon = 0;
      let previousAllocatedShipping = 0;
      // process each chunk (now indexed so we can create deterministic order_number)
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunk = chunks[chunkIndex];

        // build a deterministic order_number (short hash via util)
        const vendorSuffix = vendorId ?? "platform";
        const warehouseSuffix = chunk.warehouseId ?? "origin";
        // eslint-disable-next-line
        const order_number = buildShipwayOrderId({
          orderId: order.id,
          vendorId: vendorSuffix,
          warehouseId: warehouseSuffix,
          chunkIndex,
          prefix: "sw",
          hashLen: 12,
        });

        // build a lookup: chunk rows grouped by orderItemId
        const chunkRowsByOrderItem = new Map<
          string,
          { productVariantId?: string; qty: number }[]
        >();
        for (const ci of chunk.items) {
          const arr = chunkRowsByOrderItem.get(ci.orderItemId) ?? [];
          arr.push({ productVariantId: ci.productVariantId, qty: ci.qty });
          chunkRowsByOrderItem.set(ci.orderItemId, arr);
        }

        // map chunk items back to full orderItem objects for payload
        const comboWeightMap = new Map<string, number>();
        let totalNonComboVariantWeight = 0;
        const chunkOrderItems = chunk.items.map((ci) => {
          const original = items.find((o) => o.id === ci.orderItemId);
          const unitPrice = original?.price?.price ?? 0;

          const isCombo = !!original?.price?.productCombo;
          const productComboId = original?.price?.productCombo?.id ?? undefined;
          const originalOrderQty = original?.quantity ?? undefined;

          const productName =
            // for combo we prefer combo name; keep product/variant name otherwise
            isCombo
              ? (original?.price?.productCombo?.name ??
                original?.price?.productVariant?.product?.name ??
                null)
              : (original?.price?.productVariant?.product?.name ?? null);

          const sku = isCombo
            ? (productComboId ??
              original?.price?.productVariant?.id ??
              undefined)
            : (original?.price?.productVariant?.id ?? undefined);

          // compute weight contribution
          if (!isCombo) {
            // variant: variant weight * qty shipped in this chunk (ci.qty)
            const perUnit = Number(
              original?.price?.productVariant?.weightInGrams ?? 0,
            );
            totalNonComboVariantWeight += Math.round(
              perUnit * Number(ci.qty ?? 0),
            );
          } else {
            // combo: compute how many full combos are present in THIS chunk for this orderItemId
            if (!comboWeightMap.has(ci.orderItemId)) {
              const comboObj = original?.price?.productCombo;
              const comboWeightPerCombo = Number(
                (comboObj as any)?.weightInGrams ?? 0,
              );

              const composition = (comboObj?.items ?? []) as {
                productVariant?: any;
                quantity?: number;
              }[];

              // Sum component qtys present in this chunk for that orderItemId
              // For each component compute floor(sumQty / qtyPerCombo), then take min across components
              let combosPresentInChunk = 0;
              if (Array.isArray(composition) && composition.length > 0) {
                const compCounts: number[] = [];
                const rowsForOrderItem =
                  chunkRowsByOrderItem.get(ci.orderItemId) ?? [];
                for (const comp of composition) {
                  const vid = comp.productVariant?.id;
                  const qtyPerCombo = Math.max(
                    1,
                    Math.floor(comp.quantity ?? 1),
                  );
                  const sumForThisComp = rowsForOrderItem.reduce(
                    (s, r) =>
                      s + (r.productVariantId === vid ? Number(r.qty ?? 0) : 0),
                    0,
                  );
                  compCounts.push(Math.floor(sumForThisComp / qtyPerCombo));
                }
                combosPresentInChunk =
                  compCounts.length > 0
                    ? Math.max(0, Math.min(...compCounts))
                    : 0;
              }

              // fallback: if composition missing, try to infer combos from the chunk rows' ci.qty relative to original order quantity
              if (combosPresentInChunk === 0)
                combosPresentInChunk = Number(originalOrderQty ?? 0);

              const weightForThisOrderItem =
                comboWeightPerCombo > 0
                  ? Math.round(comboWeightPerCombo * combosPresentInChunk)
                  : Math.round(
                      composition.reduce((sum, comp) => {
                        const pvWeight = Number(
                          comp.productVariant?.weightInGrams ?? 0,
                        );
                        const qtyPerCombo = Math.max(
                          1,
                          Math.floor(comp.quantity ?? 1),
                        );
                        return sum + pvWeight * qtyPerCombo;
                      }, 0) * combosPresentInChunk,
                    );

              comboWeightMap.set(
                ci.orderItemId,
                Math.max(0, weightForThisOrderItem),
              );
            }
          }

          return {
            orderItemId: ci.orderItemId,
            quantity: ci.qty,
            price: unitPrice,
            name: productName,
            sku,
            productVariantId: ci.productVariantId,
            // preserve combo metadata for buildShipwayPayload
            productComboId,
            // mark explicit combo-price row (helps detection)
            isComboPrice: isCombo ? true : undefined,
            // keep the original order item qty (number of combos ordered) so mapper can compute combosOrdered
            originalOrderQty,
          };
        });

        const totalComboWeight = Array.from(comboWeightMap.values()).reduce(
          (a, b) => a + b,
          0,
        );
        const totalShipmentWeight =
          totalComboWeight + totalNonComboVariantWeight;

        // build payload
        // eslint-disable-next-line

        console.log(
          "chunkOrderItems (before buildShipwayPayload):",
          JSON.stringify(chunkOrderItems, null, 2),
        );

        const { payload, shippingUsed, couponUsed } = await buildShipwayPayload(
          {
            order,
            vendor,
            warehouseId: chunk.warehouseId,
            items: chunkOrderItems,
            totalShipmentWeight,
            options: {
              previousAllocatedCoupon,
              previousAllocatedShipping,
            },
          },
        );

        // send result.payload to Shipway
        previousAllocatedCoupon += couponUsed;
        previousAllocatedShipping += shippingUsed;

        // inject the Shipway order id into payload so Shipway ties this shipment to this merchant id
        // eslint-disable-next-line
        payload.order_id = order_number;

        // use order_number as idempotency key for stable retries
        // eslint-disable-next-line
        const idempotencyKey = `shipway:push:${order_number}`;

        try {
          // eslint-disable-next-line
          const res = await shipwayService.sendPushOrderToShipway(payload, {
            idempotencyKey,
            maxRetries: 3,
          });

          // handle failure
          if (!res.success) {
            const statusCode =
              res?.error?.status || res?.error?.response?.status || res.status;
            const isPermanent =
              statusCode && statusCode >= 400 && statusCode < 500;

            // eslint-disable-next-line
            await prisma.orderItem.updateMany({
              where: { id: { in: chunk.items.map((c) => c.orderItemId) } },
              data: { shipmentStatus: isPermanent ? "ERROR" : "PUSH_FAILED" },
            });

            if (!isPermanent) {
              // transient -> throw to let BullMQ retry
              throw new ApiError(
                httpStatus.BAD_GATEWAY,
                `Shipway push transient error: ${JSON.stringify(res.error)}`,
              );
            }

            // permanent failure -> continue to next chunk
            continue;
          }

          // success: parse AWB etc using the Shipway response shape you provided
          // eslint-disable-next-line
          const shipResp = res.data as any;
          const awbResp = shipResp?.awb_response ?? null;
          const awb = awbResp?.AWB ?? null;
          const carrierId = awbResp?.carrier_id ?? "shipway";
          const labelUrl = awbResp?.shipping_url ?? null;
          const pickupId = shipResp?.pickupId ?? null;

          if (!awb) {
            // eslint-disable-next-line
            console.warn("Shipway response missing AWB", {
              orderId: order.id,
              vendorId,
              shipResp,
            });
          }

          // eslint-disable-next-line
          await prisma.orderItem.updateMany({
            where: { id: { in: chunk.items.map((c) => c.orderItemId) } },
            data: {
              awbNumber: awb,
              carrierId,
              shipmentLabel: labelUrl,
              pickupId,
              shipmentStatus: "CREATED",
            },
          });

          // eslint-disable-next-line
          await prisma.shipment.create({
            data: {
              orderId: order.id,
              vendorId,
              warehouseId: chunk.warehouseId,
              shipwayOrderId: order_number,
              awb,
              carrierId,
              pickupId,
              labelUrl,
              status: "CREATED",
              orderItemIds: chunk.items.map((c) => c.orderItemId),
              allocations: chunk.items, // saved as Json (or insert to ShipmentItem rows)
              chunkIndex,
            },
          });
        } catch (err) {
          // eslint-disable-next-line
          console.error("Chunk processing failed", {
            orderId: order.id,
            vendorId,
            warehouseId: chunk.warehouseId,
            err,
          });
          // rethrow to let BullMQ handle retries for transient errors
          throw err;
        }
      } // end chunk loop
    } // end vendor loop
    // } catch (err) {
    // console.log(err);
    // }
  },
  { connection: redisConnection },
);

shipwayPushWorker.on("error", (err) => {
  if (err.message.includes("ENOTFOUND")) return;
  console.warn("[BullMQ Worker Warning]", err.message);
});

// graceful shutdown
process.on("SIGINT", async () => {
  try {
    await shipwayPushWorker.close();
    await pushOrderQueue.close();
    await prisma.$disconnect();
    process.exit(0);
    // eslint-disable-next-line
  } catch (e) {
    process.exit(1);
  }
});
process.on("SIGTERM", async () => {
  try {
    await shipwayPushWorker.close();
    await pushOrderQueue.close();
    await prisma.$disconnect();
    process.exit(0);
    // eslint-disable-next-line
  } catch (e) {
    process.exit(1);
  }
});

export default enqueuePushOrder;
