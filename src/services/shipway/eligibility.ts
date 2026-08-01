// eligibility.ts

import prisma from "@/config/prisma";
import {
  Order,
  OrderItem,
  ProductCombo,
  ComboItem,
  PrismaClient,
  Prisma,
} from "@/generated/prisma";

type EligibilityResultFail = { ok: false; message: string };
type VariantAllocation = {
  variantId: string;
  warehouseStockId: string;
  qty: number;
};
type ItemAllocation =
  // plain variant order
  | {
      itemId: string;
      isCombo: false;
      warehouseId: string;
      useCombo: false;
      variantAllocations: VariantAllocation[];
    }
  // combo fulfilled from combo stock (single warehouse)
  | {
      itemId: string;
      isCombo: true;
      warehouseId: string; // specific warehouse id or "MULTI"
      useCombo: true;
      // when fulfilled entirely from a single warehouse combo stock
      warehouseComboStockId?: string;
      // when fulfilled by combining comboStock rows across warehouses
      warehouseComboAllocations?: {
        warehouseComboStockId: string;
        qty: number;
      }[];
      qty: number;
    }
  // combo fulfilled by variant fallback (single or multi warehouse)
  | {
      itemId: string;
      isCombo: true;
      warehouseId: string;
      useCombo: false;
      variantAllocations: VariantAllocation[];
    };

type EligibilityResultSuccess = {
  ok: true;
  allocations: Record<string, ItemAllocation>;
};

type EligibilityResult = EligibilityResultSuccess | EligibilityResultFail;

type OrderWithItems = Order & {
  items: (OrderItem & {
    price?: {
      id?: string;
      productVariantId?: string;
      productVariant?: {
        id: string;
        product?: { createdById?: string };
      } | null;
      productComboId?: string | null;
      productCombo?:
        | (ProductCombo & {
            id: string;
            product?: { createdById?: string } | null;
            items?: (ComboItem & { productVariant?: { id: string } })[]; // composition
          })
        | null;
    } | null;
  })[];
};

/**
 * ensureOrderFulfillableBySingleWarehouse
 * - Checks fulfillment eligibility for all order items by vendor.
 *
 * Combo rules:
 *  - Prefer WarehouseComboStock (comboCount).
 *  - Fallback: try variant-level fulfillment in a single warehouse.
 *  - Optional (if enabled): allow fulfilling combo variants across multiple warehouses.
 *
 * Variant rules:
 *  - Prefer single warehouse with enough stock.
 *  - Optional (if enabled): allow split across multiple warehouses.
 */
const allowComboVariantFallback = false;
const allowMultiWarehouseFulfillment = true;
const allowComboMultiWarehouseSplit = true;

const ensureOrderFulfillableBySingleWarehouse = async (
  orderId: string,
  db: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<EligibilityResult> => {
  const order = (await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          price: {
            include: {
              productVariant: {
                include: {
                  product: true,
                },
              },
              productCombo: {
                include: {
                  product: { select: { createdById: true } },
                  items: { include: { productVariant: true } },
                },
              },
            },
          },
        },
      },
    },
  })) as OrderWithItems | null;

  if (!order) return { ok: false, message: "Order not found" };

  type GroupItem = {
    itemId: string;
    isCombo: boolean;
    variantId?: string;
    comboId?: string;
    comboComposition?: { variantId: string; qtyPerCombo: number }[] | null;
    qty: number;
  };

  const vendorGroups = new Map<string, GroupItem[]>();

  for (const it of order.items) {
    const price = it.price ?? null;
    const pvId = price?.productVariantId ?? price?.productVariant?.id ?? null;
    const pcId = price?.productComboId ?? price?.productCombo?.id ?? null;

    if (!pvId && !pcId) {
      return {
        ok: false,
        message: `Order item ${it.id} missing variant/combo.`,
      };
    }

    let vendorId: string | null = null;
    if (price?.productVariant?.product?.createdById)
      vendorId = price.productVariant.product.createdById ?? null;
    else if (price?.productCombo?.product?.createdById)
      vendorId = price.productCombo.product.createdById ?? null;

    if (!vendorId) continue; // platform-owned skip

    if (pcId && price?.productCombo) {
      const combo = price.productCombo;
      const rawItems = combo.items ?? [];
      const missingMapping = rawItems.some((ci) => !ci.productVariant?.id);
      if (missingMapping) {
        return {
          ok: false,
          message: `Combo ${pcId} missing variant mapping.`,
        };
      }
      const composition = rawItems.map((ci) => ({
        variantId: ci.productVariant!.id,
        qtyPerCombo: ci.quantity ?? 1,
      }));
      if (!vendorGroups.has(vendorId)) vendorGroups.set(vendorId, []);
      vendorGroups.get(vendorId)!.push({
        itemId: it.id,
        isCombo: true,
        comboId: pcId,
        comboComposition: composition,
        qty: it.quantity,
      });
    } else {
      if (!pvId)
        return {
          ok: false,
          message: `Item ${it.id} missing productVariantId.`,
        };
      if (!vendorGroups.has(vendorId)) vendorGroups.set(vendorId, []);
      vendorGroups.get(vendorId)!.push({
        itemId: it.id,
        isCombo: false,
        variantId: pvId,
        qty: it.quantity,
      });
    }
  }

  const allocations: Record<string, ItemAllocation> = {};

  for (const [vendorId, items] of vendorGroups.entries()) {
    const variantIds: string[] = [];
    const comboIds: string[] = [];

    for (const it of items) {
      if (!it.isCombo && it.variantId) variantIds.push(it.variantId);
      if (it.isCombo) {
        comboIds.push(it.comboId!);
        for (const c of it.comboComposition ?? []) variantIds.push(c.variantId);
      }
    }

    const warehouses = await db.warehouse.findMany({
      where: { vendorId },
      include: {
        warehouseStocks: {
          where: { productVariantId: { in: variantIds } },
        },
        warehouseComboStocks: {
          where: { productComboId: { in: comboIds } },
        },
      },
    });

    if (!warehouses.length)
      return { ok: false, message: `No warehouses for vendor ${vendorId}` };

    // Build in-memory maps. These objects are mutable and will be modified as we allocate.
    const whVariantMap = new Map<
      string,
      Map<string, { id: string; count: number }>
    >();
    const whComboMap = new Map<
      string,
      Map<string, { id: string; count: number }>
    >();

    // Map stockId -> warehouseId (so we can return a real warehouseId for multi allocations)
    const stockIdToWarehouseId = new Map<string, string>();

    // Track total availability across warehouses (useful for quick checks)
    const totalAvailableByVariant = new Map<string, number>();

    for (const wh of warehouses) {
      const vmap = new Map<string, { id: string; count: number }>();
      for (const s of wh.warehouseStocks) {
        // s.id is warehouseStock id; wh.id is warehouse id
        vmap.set(s.productVariantId, { id: s.id, count: s.productCount ?? 0 });
        stockIdToWarehouseId.set(s.id, wh.id);
        const prev = totalAvailableByVariant.get(s.productVariantId) ?? 0;
        totalAvailableByVariant.set(
          s.productVariantId,
          prev + (s.productCount ?? 0),
        );
      }
      whVariantMap.set(wh.id, vmap);

      const cmap = new Map<string, { id: string; count: number }>();
      for (const cs of wh.warehouseComboStocks) {
        cmap.set(cs.productComboId, { id: cs.id, count: cs.comboCount ?? 0 });
        stockIdToWarehouseId.set(cs.id, wh.id);
      }
      whComboMap.set(wh.id, cmap);
    }

    // ---------- Non-Combo Items ----------
    for (const it of items.filter((i) => !i.isCombo)) {
      // total available across all warehouses for this variant
      const totalAvailable = totalAvailableByVariant.get(it.variantId!) ?? 0;

      if (totalAvailable < it.qty) {
        return {
          ok: false,
          message: `Variant ${it.variantId} has insufficient total stock across all warehouses for vendor ${vendorId}.`,
        };
      }

      // Try single warehouse first
      let chosenWhId: string | null = null;
      let chosenStockEntry: { id: string; count: number } | null = null;
      for (const [whId, vmap] of whVariantMap.entries()) {
        const stock = vmap.get(it.variantId!);
        if (stock && stock.count >= it.qty) {
          chosenWhId = whId;
          chosenStockEntry = stock;
          break;
        }
      }

      if (!chosenWhId || !chosenStockEntry) {
        if (!allowMultiWarehouseFulfillment) {
          return {
            ok: false,
            message: `Variant ${it.variantId} cannot be fulfilled by a single warehouse.`,
          };
        }

        // Multi-warehouse split (greedy, deterministic order)
        let qtyRemaining = it.qty;
        const multiAllocations: VariantAllocation[] = [];
        const sortedEntries = Array.from(whVariantMap.entries()).sort(
          ([a], [b]) => a.localeCompare(b),
        );

        for (const [, vmap] of sortedEntries) {
          const stock = vmap.get(it.variantId!);
          if (!stock || stock.count <= 0) continue;
          const useQty = Math.min(stock.count, qtyRemaining);
          multiAllocations.push({
            variantId: it.variantId!,
            warehouseStockId: stock.id,
            qty: useQty,
          });
          // simulate consumption
          stock.count -= useQty;
          totalAvailableByVariant.set(
            it.variantId!,
            (totalAvailableByVariant.get(it.variantId!) ?? 0) - useQty,
          );
          qtyRemaining -= useQty;
          if (qtyRemaining <= 0) break;
        }
        if (qtyRemaining > 0)
          return {
            ok: false,
            message: `Variant ${it.variantId} insufficient even across multiple warehouses.`,
          };

        // determine a deterministic warehouseId to return (use the warehouse that supplied the first piece)
        let chosenWarehouseIdForMulti = stockIdToWarehouseId.get(
          multiAllocations[0].warehouseStockId,
        );
        if (!chosenWarehouseIdForMulti) chosenWarehouseIdForMulti = "MULTI";

        allocations[it.itemId] = {
          itemId: it.itemId,
          isCombo: false,
          warehouseId: chosenWarehouseIdForMulti,
          useCombo: false,
          variantAllocations: multiAllocations,
        };
        continue;
      }

      // single warehouse path -> consume stock in-memory
      allocations[it.itemId] = {
        itemId: it.itemId,
        isCombo: false,
        warehouseId: chosenWhId,
        useCombo: false,
        variantAllocations: [
          {
            variantId: it.variantId!,
            warehouseStockId: chosenStockEntry.id,
            qty: it.qty,
          },
        ],
      };

      // decrement simulated stock
      chosenStockEntry.count -= it.qty;
      totalAvailableByVariant.set(
        it.variantId!,
        (totalAvailableByVariant.get(it.variantId!) ?? 0) - it.qty,
      );
    }

    // ---------- Combo Items ----------
    for (const comboItem of items.filter((i) => i.isCombo)) {
      const comboId = comboItem.comboId!;
      const combosOrdered = comboItem.qty;

      // 1. Try combo stock (single warehouse)
      let foundComboWarehouse: {
        whId: string;
        csEntry: { id: string; count: number };
      } | null = null;
      for (const [whId, cmap] of whComboMap.entries()) {
        const cs = cmap.get(comboId);
        if (cs && cs.count >= combosOrdered) {
          foundComboWarehouse = { whId, csEntry: cs };
          break;
        }
      }
      if (foundComboWarehouse) {
        allocations[comboItem.itemId] = {
          itemId: comboItem.itemId,
          isCombo: true,
          warehouseId: foundComboWarehouse.whId,
          useCombo: true,
          warehouseComboStockId: foundComboWarehouse.csEntry.id,
          qty: combosOrdered,
        };
        // simulate consumption
        foundComboWarehouse.csEntry.count -= combosOrdered;
        continue;
      }

      // 1.b Try combo stock **multi-warehouse** split (if allowed)
      if (allowComboMultiWarehouseSplit) {
        let qtyRemaining = combosOrdered;

        // Probe phase (do NOT mutate original cs.count)
        const comboProbeAllocations: {
          warehouseComboStockId: string;
          qty: number;
          whId: string;
        }[] = [];

        const sortedCmapEntries = Array.from(whComboMap.entries()).sort(
          ([a], [b]) => a.localeCompare(b),
        ); // sorted by warehouse id for determinism

        for (const [whId, cmap] of sortedCmapEntries) {
          const cs = cmap.get(comboId);
          const available = cs?.count ?? 0;
          if (!cs || available <= 0) continue;
          const useQty = Math.min(available, qtyRemaining);
          comboProbeAllocations.push({
            warehouseComboStockId: cs.id,
            qty: useQty,
            whId,
          });
          qtyRemaining -= useQty;
          if (qtyRemaining <= 0) break;
        }

        if (qtyRemaining <= 0) {
          // Commit phase: apply decrements to the original cs.count entries
          for (const a of comboProbeAllocations) {
            // find the original cs entry in the whComboMap and decrement it
            // (we stored cmap entries earlier as objects so this mutates the same objects)
            // find the cmap that contains this stock id
            // quick path: use stockIdToWarehouseId to get warehouse id, then access that cmap
            const whIdForStock = stockIdToWarehouseId.get(
              a.warehouseComboStockId,
            );
            if (whIdForStock) {
              const cmap = whComboMap.get(whIdForStock);
              const csEntry = cmap?.get(comboId);
              if (csEntry) {
                csEntry.count -= a.qty;
                // keep counts non-negative just in case (defensive)
                if (csEntry.count < 0) csEntry.count = 0;
              }
            } else {
              // fallback: try to find by scanning (shouldn't happen if stockIdToWarehouseId was populated)
              for (const [, cmap] of whComboMap.entries()) {
                const csEntry = cmap.get(comboId);
                if (csEntry && csEntry.id === a.warehouseComboStockId) {
                  csEntry.count -= a.qty;
                  if (csEntry.count < 0) csEntry.count = 0;
                  break;
                }
              }
            }
          }

          // choose deterministic warehouseId to return (warehouse that supplied first piece)
          const firstStockId = comboProbeAllocations[0]?.warehouseComboStockId;
          let chosenWarehouseIdForMulti = firstStockId
            ? stockIdToWarehouseId.get(firstStockId)
            : undefined;
          if (!chosenWarehouseIdForMulti) chosenWarehouseIdForMulti = "MULTI";

          // shape the allocations to match the union type (warehouseComboAllocations)
          allocations[comboItem.itemId] = {
            itemId: comboItem.itemId,
            isCombo: true,
            warehouseId: chosenWarehouseIdForMulti,
            useCombo: true,
            warehouseComboAllocations: comboProbeAllocations.map((a) => ({
              warehouseComboStockId: a.warehouseComboStockId,
              qty: a.qty,
            })),
            qty: combosOrdered,
          };
          continue; // done with this comboItem
        }

        // If we reached here, probe failed; we didn't mutate original counts,
        // so nothing to restore. The code will fall through to variant fallback or error.
      }

      // 2. Variant-level fallback
      if (!allowComboVariantFallback)
        return {
          ok: false,
          message: `Combo ${comboId} cannot be fulfilled by combo stock.`,
        };

      // Build required totals by component variant
      const requiredByVariant = new Map<string, number>();
      for (const ci of comboItem.comboComposition ?? []) {
        const need =
          (requiredByVariant.get(ci.variantId) ?? 0) +
          (ci.qtyPerCombo ?? 1) * combosOrdered;
        requiredByVariant.set(ci.variantId, need);
      }

      // Quick check: every required variant must exist in totalAvailableByVariant
      for (const [vid, qtyNeeded] of requiredByVariant.entries()) {
        const totalAvail = totalAvailableByVariant.get(vid) ?? 0;
        if (totalAvail < qtyNeeded) {
          return {
            ok: false,
            message: `Combo ${comboId} component ${vid} has insufficient total stock across all warehouses.`,
          };
        }
      }

      // single-warehouse check first
      let chosenWhForCombo: string | null = null;
      for (const [whId, vmap] of whVariantMap.entries()) {
        let canFulfill = true;
        for (const [vid, qtyNeeded] of requiredByVariant.entries()) {
          if ((vmap.get(vid)?.count ?? 0) < qtyNeeded) {
            canFulfill = false;
            break;
          }
        }
        if (canFulfill) {
          chosenWhForCombo = whId;
          break;
        }
      }

      if (chosenWhForCombo) {
        const variantAllocations: VariantAllocation[] = [];
        const vmapForChosen = whVariantMap.get(chosenWhForCombo)!;
        for (const [vid, qtyNeeded] of requiredByVariant.entries()) {
          const stock = vmapForChosen.get(vid);
          if (!stock)
            return {
              ok: false,
              message: `Warehouse ${chosenWhForCombo} missing stock for ${vid}.`,
            };
          variantAllocations.push({
            variantId: vid,
            warehouseStockId: stock.id,
            qty: qtyNeeded,
          });
          // simulate consumption
          stock.count -= qtyNeeded;
          totalAvailableByVariant.set(
            vid,
            (totalAvailableByVariant.get(vid) ?? 0) - qtyNeeded,
          );
        }

        allocations[comboItem.itemId] = {
          itemId: comboItem.itemId,
          isCombo: true,
          warehouseId: chosenWhForCombo,
          useCombo: false,
          variantAllocations,
        };
        continue;
      }

      // 3. Multi-warehouse split only if allowed
      if (!allowComboMultiWarehouseSplit)
        return {
          ok: false,
          message: `Combo ${comboId} cannot be fulfilled by a single warehouse.`,
        };

      // (We already pre-checked totals above.) Greedily take from warehouses for each component
      const variantAllocations: VariantAllocation[] = [];
      for (const [vid, qtyNeeded] of requiredByVariant.entries()) {
        let qtyRemaining = qtyNeeded;
        const sortedEntries = Array.from(whVariantMap.entries()).sort(
          ([a], [b]) => a.localeCompare(b),
        );
        for (const [, vmap] of sortedEntries) {
          const stock = vmap.get(vid);
          if (!stock || stock.count <= 0) continue;
          const useQty = Math.min(stock.count, qtyRemaining);
          variantAllocations.push({
            variantId: vid,
            warehouseStockId: stock.id,
            qty: useQty,
          });
          // simulate consumption
          stock.count -= useQty;
          totalAvailableByVariant.set(
            vid,
            (totalAvailableByVariant.get(vid) ?? 0) - useQty,
          );
          qtyRemaining -= useQty;
          if (qtyRemaining <= 0) break;
        }
        if (qtyRemaining > 0)
          return {
            ok: false,
            message: `Combo ${comboId} component ${vid} insufficient even across warehouses.`,
          };
      }

      // choose deterministic warehouseId for this multi allocation (warehouse that provided the first allocated piece)
      let chosenWarehouseForComboMulti: string | undefined = undefined;
      if (variantAllocations.length > 0) {
        chosenWarehouseForComboMulti = stockIdToWarehouseId.get(
          variantAllocations[0].warehouseStockId,
        );
      }
      if (!chosenWarehouseForComboMulti) chosenWarehouseForComboMulti = "MULTI";

      allocations[comboItem.itemId] = {
        itemId: comboItem.itemId,
        isCombo: true,
        warehouseId: chosenWarehouseForComboMulti,
        useCombo: false,
        variantAllocations,
      };
    }
  }

  return { ok: true, allocations };
};

export default ensureOrderFulfillableBySingleWarehouse;
