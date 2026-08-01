// src/jobs/allocator.ts
import prisma from "@/config/prisma";
import { Prisma } from "@/generated/prisma";
import ApiError from "@/utils/ApiError";
import { UnrecoverableError } from "bullmq";
import { status as httpStatus } from "http-status";

/**
 * AllocatorItem: shape expected by allocator (created by worker)
 */
export type AllocatorItem = {
  id: string;
  quantity: number;
  price?: { productVariantId?: string };
  comboGroupId?: string;
  qtyPerCombo?: number;
  productComboId?: string;
  comboComposition?: { productVariantId: string; qtyPerCombo: number }[] | null;
};

/**
 * Chunk: allocation unit that will be pushed to Shipway
 */
export type Chunk = {
  warehouseId: string | null;
  items: { orderItemId: string; productVariantId: string; qty: number }[];
};

/**
 * Allocation control flags
 * - allowComboVariantFallback: allow combos to fall back to variant-level fulfillment
 * - allowMultiWarehouseFulfillment: allow normal variant items to split across warehouses
 * - allowComboMultiWarehouseSplit: allow combo components to be taken from multiple warehouses
 */
const allowComboVariantFallback = false;
const allowMultiWarehouseFulfillment = true;
const allowComboMultiWarehouseSplit = true;

const allocateAndReserve = async (
  vendorId: string,
  items: AllocatorItem[],
): Promise<Chunk[]> => {
  if (!vendorId) {
    // eslint-disable-next-line
    console.log(`vendorId is required for allocateAndReserve`);
    throw new UnrecoverableError(`vendorId is required for allocateAndReserve`);
  }

  if (!Array.isArray(items) || items.length === 0) return [];

  // Split into combo groups + normal items
  const comboGroups = new Map<string, AllocatorItem[]>();
  const normalItems: AllocatorItem[] = [];

  for (const it of items) {
    if (it.comboGroupId) {
      if (!comboGroups.has(it.comboGroupId))
        comboGroups.set(it.comboGroupId, []);
      comboGroups.get(it.comboGroupId)!.push(it);
    } else {
      normalItems.push(it);
    }
  }

  // Collect variant ids and combo ids
  const variantIdSet = new Set<string>();
  const comboIdSet = new Set<string>();
  for (const it of items) {
    if (it.price?.productVariantId) variantIdSet.add(it.price.productVariantId);
    if (it.comboComposition && it.comboComposition.length) {
      for (const c of it.comboComposition)
        if (c.productVariantId) variantIdSet.add(c.productVariantId);
    }
    if (it.productComboId) comboIdSet.add(it.productComboId);
    else if (it.comboGroupId) comboIdSet.add(it.comboGroupId);
  }
  let variantIds = Array.from(variantIdSet);
  const comboIds = Array.from(comboIdSet);

  // Fetch missing combo compositions once
  const combosNeedingFetch = new Set<string>();
  for (const it of items) {
    const comboId = it.productComboId ?? it.comboGroupId;
    if (comboId && (!it.comboComposition || it.comboComposition.length === 0))
      combosNeedingFetch.add(comboId);
  }

  const comboCompositionCache = new Map<
    string,
    { productVariantId: string; qtyPerCombo: number }[]
  >();

  if (combosNeedingFetch.size > 0) {
    const combos = await prisma.productCombo.findMany({
      where: { id: { in: Array.from(combosNeedingFetch) } },
      include: {
        items: { select: { productVariantId: true, quantity: true } },
      },
    });

    for (const c of combos) {
      const comp = (c.items ?? []).map((ci: any) => ({
        productVariantId: ci.productVariantId,
        qtyPerCombo: ci.quantity ?? 1,
      }));
      comboCompositionCache.set(c.id, comp);
      for (const it of comp)
        if (it.productVariantId) variantIdSet.add(it.productVariantId);
    }
    variantIds = Array.from(variantIdSet);
  }

  // Fetch warehouses and related stocks
  const warehouses = await prisma.warehouse.findMany({
    where: { vendorId },
    include: {
      warehouseStocks: variantIds.length
        ? {
            where: { productVariantId: { in: variantIds } },
            select: {
              productVariantId: true,
              productCount: true,
              warehouseId: true,
            },
          }
        : {
            where: { productVariantId: { in: [] } },
            select: {
              productVariantId: true,
              productCount: true,
              warehouseId: true,
            },
          },
      warehouseComboStocks: comboIds.length
        ? {
            where: { productComboId: { in: comboIds } },
            select: {
              productComboId: true,
              comboCount: true,
              warehouseId: true,
            },
          }
        : {
            where: { productComboId: { in: [] } },
            select: {
              productComboId: true,
              comboCount: true,
              warehouseId: true,
            },
          },
    },
  });

  if (!warehouses || warehouses.length === 0) {
    // eslint-disable-next-line
    console.log(`No warehouses found for vendor ${vendorId}`);
    throw new UnrecoverableError(`No warehouses found for vendor ${vendorId}`);
  }

  // Quick check for normal items: require at least one warehouse that can satisfy the whole normal item.
  for (const it of normalItems) {
    const variantId = it.price?.productVariantId;
    if (!variantId) {
      throw new UnrecoverableError(
        `Normal item ${it.id} missing productVariantId`,
      );
    }
    const hasWarehouse = warehouses.some(
      (wh) =>
        (wh.warehouseStocks.find((s) => s.productVariantId === variantId)
          ?.productCount ?? 0) >= it.quantity,
    );
    if (!hasWarehouse) {
      if (!allowMultiWarehouseFulfillment) {
        throw new UnrecoverableError(
          `Item ${it.id} (variant ${variantId}) cannot be fulfilled by a single warehouse for vendor ${vendorId}.`,
        );
      }
    }
  }

  // For each combo group, ensure total feasibility: either combo stock OR enough total variant stock across warehouses (if fallback allowed)
  for (const [comboGroupId, rows] of comboGroups.entries()) {
    const comboId = rows[0].productComboId ?? rows[0].comboGroupId!;
    const combosOrdered = Math.floor(
      rows[0].quantity / (rows[0].qtyPerCombo ?? 1),
    );

    const hasComboStock = warehouses.some((wh) =>
      (wh.warehouseComboStocks ?? []).some(
        (cs) =>
          cs.productComboId === comboId &&
          (cs.comboCount ?? 0) >= combosOrdered,
      ),
    );
    if (hasComboStock) continue;

    // Debug note — no single-warehouse combo stock found
    console.log(
      "DEBUG combo no single-warehouse combo stock",
      comboGroupId,
      "comboId:",
      comboId,
      "combosRequested:",
      combosOrdered,
      "warehouseComboStocks:",
      warehouses.map((w) => ({
        wh: w.id,
        comboCount:
          w.warehouseComboStocks?.find((cs) => cs.productComboId === comboId)
            ?.comboCount ?? 0,
      })),
    );
  }

  // Build in-memory maps for greedy allocation
  const whMaps = warehouses.map((wh) => ({
    id:
      wh.id ??
      wh.warehouseStocks[0]?.warehouseId ??
      wh.warehouseComboStocks[0]?.warehouseId,
    stock: new Map<string, number>(
      (wh.warehouseStocks ?? []).map((s) => [
        s.productVariantId,
        s.productCount,
      ]),
    ),
    comboMap: new Map<string, number>(
      (wh.warehouseComboStocks ?? []).map((c) => [
        c.productComboId,
        c.comboCount,
      ]),
    ),
  }));

  type AllocationItem = {
    orderItemId: string;
    productVariantId: string;
    qty: number;
  };

  // Split: shipping allocations vs variant reservations
  const allocationsForShipping = new Map<string, AllocationItem[]>(); // always used to build chunks for Shipway
  const variantReservations = new Map<string, AllocationItem[]>(); // only entries we will decrement from warehouseStock
  const comboReservedDuringAllocation = new Map<string, Map<string, number>>(); // whId -> (comboId -> reserved)

  // 1) Assign combo groups (keep intact if using combo stock; otherwise fallback logic applies)
  for (const [comboGroupId, rows] of comboGroups.entries()) {
    const comboId = rows[0].productComboId ?? rows[0].comboGroupId!;
    const combosRequested = Math.floor(
      rows[0].quantity / (rows[0].qtyPerCombo ?? 1),
    );

    let assigned = false;

    // Prefer combo stock in a single warehouse
    for (const wh of whMaps) {
      const availCombo = wh.comboMap.get(comboId) ?? 0;
      if (availCombo >= combosRequested) {
        wh.comboMap.set(comboId, availCombo - combosRequested);

        // record reservation for db later (combo stock)
        if (!comboReservedDuringAllocation.has(wh.id))
          comboReservedDuringAllocation.set(wh.id, new Map());
        comboReservedDuringAllocation
          .get(wh.id)!
          .set(
            comboId,
            (comboReservedDuringAllocation.get(wh.id)!.get(comboId) ?? 0) +
              combosRequested,
          );

        // produce allocations for shipping (expand composition)
        const composition =
          rows[0].comboComposition && rows[0].comboComposition.length
            ? rows[0].comboComposition
            : (comboCompositionCache.get(comboId) ?? []);
        if (composition.length === 0)
          throw new UnrecoverableError(
            `Missing combo composition for combo ${comboGroupId}`,
          );

        for (const r of rows) {
          const combosOrderedRow = r.qtyPerCombo
            ? Math.floor(r.quantity / r.qtyPerCombo)
            : combosRequested;
          for (const comp of composition) {
            // **only add to shipping allocations** — do NOT reserve variant stock
            if (!allocationsForShipping.has(wh.id))
              allocationsForShipping.set(wh.id, []);
            allocationsForShipping.get(wh.id)!.push({
              orderItemId: r.id,
              productVariantId: comp.productVariantId,
              qty: (comp.qtyPerCombo ?? 1) * combosOrderedRow,
            });
          }
        }

        assigned = true;
        break;
      }
    }
    if (assigned) continue;

    // AFTER single-warehouse combo stock attempt, BEFORE variant fallback:
    if (!assigned && allowComboMultiWarehouseSplit) {
      let qtyRemaining = combosRequested;
      const probe: { whId: string; take: number }[] = [];

      // probe greedy across whMaps
      for (const wh of whMaps) {
        const avail = wh.comboMap.get(comboId) ?? 0;
        if (avail <= 0) continue;
        const take = Math.min(avail, qtyRemaining);
        probe.push({ whId: wh.id, take });
        qtyRemaining -= take;
        if (qtyRemaining <= 0) break;
      }

      if (qtyRemaining <= 0) {
        // commit: decrement in-memory combo counts and record reservations
        for (const p of probe) {
          const whEntry = whMaps.find((w) => w.id === p.whId)!;
          const prev = whEntry.comboMap.get(comboId) ?? 0;
          whEntry.comboMap.set(comboId, Math.max(0, prev - p.take));

          if (!comboReservedDuringAllocation.has(whEntry.id))
            comboReservedDuringAllocation.set(whEntry.id, new Map());
          const perWhMap = comboReservedDuringAllocation.get(whEntry.id)!;
          perWhMap.set(comboId, (perWhMap.get(comboId) ?? 0) + p.take);
        }

        // produce allocationsForShipping for rows: distribute each row's component quantities
        const composition =
          rows[0].comboComposition && rows[0].comboComposition.length
            ? rows[0].comboComposition
            : (comboCompositionCache.get(comboId) ?? []);
        if (composition.length === 0)
          throw new UnrecoverableError(
            `Missing combo composition for combo ${comboGroupId}`,
          );

        // ---- NEW: two-stage deterministic distribution (probe supplies combos, then per-row consume) ----
        const probeSupplies = probe.map((p) => ({
          whId: p.whId,
          combos: p.take,
        }));

        for (const comp of composition) {
          const qtyPerCombo = comp.qtyPerCombo ?? 1;
          const totalCompNeeded = qtyPerCombo * combosRequested;

          // convert probe combos -> component units
          const perProbeRemaining = probeSupplies.map((p) => ({
            whId: p.whId,
            remainingUnits: p.combos * qtyPerCombo,
          }));

          // allocate per-row from probes (greedy, in probe order)
          for (const r of rows) {
            const combosOrderedRow = r.qtyPerCombo
              ? Math.floor(r.quantity / r.qtyPerCombo)
              : combosRequested;
            let neededForRow = qtyPerCombo * combosOrderedRow;

            for (const pEntry of perProbeRemaining) {
              if (neededForRow <= 0) break;
              if (pEntry.remainingUnits <= 0) continue;

              const take = Math.min(pEntry.remainingUnits, neededForRow);

              if (!allocationsForShipping.has(pEntry.whId))
                allocationsForShipping.set(pEntry.whId, []);
              allocationsForShipping.get(pEntry.whId)!.push({
                orderItemId: r.id,
                productVariantId: comp.productVariantId,
                qty: take,
              });

              pEntry.remainingUnits -= take;
              neededForRow -= take;
            }

            // defensive fallback (shouldn't happen)
            if (neededForRow > 0) {
              const fallbackWh = perProbeRemaining[0];
              if (!allocationsForShipping.has(fallbackWh.whId))
                allocationsForShipping.set(fallbackWh.whId, []);
              allocationsForShipping.get(fallbackWh.whId)!.push({
                orderItemId: r.id,
                productVariantId: comp.productVariantId,
                qty: neededForRow,
              });
              fallbackWh.remainingUnits = Math.max(
                0,
                fallbackWh.remainingUnits - neededForRow,
              );
              neededForRow = 0;
            }
          }

          // sanity check: allocated must equal total needed
          const allocatedForComp = Array.from(allocationsForShipping.values())
            .flat()
            .filter((a) => a.productVariantId === comp.productVariantId)
            .reduce((s, a) => s + a.qty, 0);

          if (allocatedForComp !== totalCompNeeded) {
            console.warn(
              `Distribution mismatch for combo ${comboGroupId} comp ${comp.productVariantId}: allocated=${allocatedForComp} expected=${totalCompNeeded}.`,
            );
            throw new ApiError(
              httpStatus.PRECONDITION_REQUIRED,
              `Combo ${comboGroupId} distribution mismatch for component ${comp.productVariantId}.`,
            );
          }
        }

        assigned = true;
      }
    }

    // Do this only when fallback is allowed.
    if (!assigned) {
      if (!allowComboVariantFallback) {
        // no fallback allowed — throw now
        throw new UnrecoverableError(
          `Combo ${comboGroupId} cannot be fulfilled and variant fallback is disabled.`,
        );
      }

      // Now check component totals across warehouses (only now — after trying combo-stock)
      const composition =
        rows[0].comboComposition && rows[0].comboComposition.length
          ? rows[0].comboComposition
          : (comboCompositionCache.get(comboId) ?? []);
      if (composition.length === 0) {
        throw new UnrecoverableError(
          `Missing combo composition for combo ${comboGroupId}`,
        );
      }

      // verify totals across whMaps
      for (const comp of composition) {
        const needed = (comp.qtyPerCombo ?? 1) * combosRequested;
        const totalAvailable = whMaps.reduce((sum, wh) => {
          return sum + (wh.stock.get(comp.productVariantId) ?? 0);
        }, 0);
        if (totalAvailable < needed) {
          throw new UnrecoverableError(
            `Combo ${comboGroupId} component ${comp.productVariantId} has insufficient total stock across warehouses.`,
          );
        }
      }

      // At this point variant totals are sufficient — proceed with variant-level allocation logic

      // If combo components must be taken from single warehouse
      if (!allowComboMultiWarehouseSplit) {
        // find a single warehouse that can provide all required component totals
        let found = false;
        for (const wh of whMaps) {
          let ok = true;
          for (const r of rows) {
            const rowComposition =
              r.comboComposition && r.comboComposition.length
                ? r.comboComposition
                : (comboCompositionCache.get(comboId) ?? []);
            if (rowComposition.length === 0) {
              ok = false;
              break;
            }
            for (const comp of rowComposition) {
              const needed =
                (comp.qtyPerCombo ?? 1) *
                Math.floor(
                  r.quantity / (r.qtyPerCombo ?? comp.qtyPerCombo ?? 1),
                );
              if ((wh.stock.get(comp.productVariantId) ?? 0) < needed) {
                ok = false;
                break;
              }
            }
            if (!ok) break;
          }
          if (!ok) continue;

          // Reserve from this warehouse and add allocations (both shipping + variantReservations)
          for (const r of rows) {
            const rowComposition =
              r.comboComposition && r.comboComposition.length
                ? r.comboComposition
                : (comboCompositionCache.get(comboId) ?? []);
            const combosOrderedRow = r.qtyPerCombo
              ? Math.floor(r.quantity / r.qtyPerCombo)
              : Math.floor(r.quantity / (rowComposition[0]?.qtyPerCombo ?? 1));
            for (const comp of rowComposition) {
              const take = (comp.qtyPerCombo ?? 1) * combosOrderedRow;

              // decrement in-memory stock
              wh.stock.set(
                comp.productVariantId,
                (wh.stock.get(comp.productVariantId) ?? 0) - take,
              );

              // shipping allocation
              if (!allocationsForShipping.has(wh.id))
                allocationsForShipping.set(wh.id, []);
              allocationsForShipping.get(wh.id)!.push({
                orderItemId: r.id,
                productVariantId: comp.productVariantId,
                qty: take,
              });

              // record variant reservation for DB decrement
              if (!variantReservations.has(wh.id))
                variantReservations.set(wh.id, []);
              variantReservations.get(wh.id)!.push({
                orderItemId: r.id,
                productVariantId: comp.productVariantId,
                qty: take,
              });
            }
          }
          found = true;
          break;
        }
        if (!found) {
          throw new ApiError(
            httpStatus.PRECONDITION_REQUIRED,
            `Combo ${comboGroupId} could not be fulfilled from a single warehouse.`,
          );
        }
      } else {
        // allow multi-warehouse split for combo components variant path (greedy)
        for (const r of rows) {
          const rowComposition =
            r.comboComposition && r.comboComposition.length
              ? r.comboComposition
              : (comboCompositionCache.get(comboId) ?? []);
          if (rowComposition.length === 0)
            throw new UnrecoverableError(
              `Missing combo composition for combo ${comboGroupId}`,
            );
          for (const comp of rowComposition) {
            let remaining =
              (comp.qtyPerCombo ?? 1) *
              Math.floor(r.quantity / (r.qtyPerCombo ?? comp.qtyPerCombo ?? 1));
            for (const wh of whMaps) {
              if (remaining === 0) break;
              const avail = wh.stock.get(comp.productVariantId) ?? 0;
              if (avail <= 0) continue;
              const take = Math.min(avail, remaining);

              // reduce in-memory stock
              wh.stock.set(comp.productVariantId, avail - take);

              // shipping allocation
              if (!allocationsForShipping.has(wh.id))
                allocationsForShipping.set(wh.id, []);
              allocationsForShipping.get(wh.id)!.push({
                orderItemId: r.id,
                productVariantId: comp.productVariantId,
                qty: take,
              });

              // record variant reservation for DB decrement
              if (!variantReservations.has(wh.id))
                variantReservations.set(wh.id, []);
              variantReservations.get(wh.id)!.push({
                orderItemId: r.id,
                productVariantId: comp.productVariantId,
                qty: take,
              });

              remaining -= take;
            }
            if (remaining > 0) {
              throw new ApiError(
                httpStatus.PRECONDITION_REQUIRED,
                `Combo ${comboGroupId} component ${comp.productVariantId} could not be fully allocated.`,
              );
            }
          }
        }
      }
    } // end if (!assigned)
  }

  // 2) Allocate normal items (respect allowMultiWarehouseFulfillment)
  for (const it of normalItems) {
    const vid = it.price?.productVariantId;
    if (!vid)
      throw new UnrecoverableError(
        `Missing productVariantId for normal item ${it.id}`,
      );
    let remaining = it.quantity;

    if (!allowMultiWarehouseFulfillment) {
      // require single warehouse to have full quantity
      const wh = whMaps.find((w) => (w.stock.get(vid) ?? 0) >= remaining);
      if (!wh) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Variant ${vid} cannot be fulfilled from a single warehouse.`,
        );
      }
      wh.stock.set(vid, (wh.stock.get(vid) ?? 0) - remaining);

      // shipping allocation
      if (!allocationsForShipping.has(wh.id))
        allocationsForShipping.set(wh.id, []);
      allocationsForShipping
        .get(wh.id)!
        .push({ orderItemId: it.id, productVariantId: vid, qty: remaining });

      // variant reservation
      if (!variantReservations.has(wh.id)) variantReservations.set(wh.id, []);
      variantReservations
        .get(wh.id)!
        .push({ orderItemId: it.id, productVariantId: vid, qty: remaining });
    } else {
      // split across warehouses greedily
      for (const wh of whMaps) {
        if (remaining === 0) break;
        const avail = wh.stock.get(vid) ?? 0;
        if (avail <= 0) continue;
        const take = Math.min(avail, remaining);
        wh.stock.set(vid, avail - take);

        // shipping allocation
        if (!allocationsForShipping.has(wh.id))
          allocationsForShipping.set(wh.id, []);
        allocationsForShipping
          .get(wh.id)!
          .push({ orderItemId: it.id, productVariantId: vid, qty: take });

        // variant reservation
        if (!variantReservations.has(wh.id)) variantReservations.set(wh.id, []);
        variantReservations
          .get(wh.id)!
          .push({ orderItemId: it.id, productVariantId: vid, qty: take });

        remaining -= take;
      }
      if (remaining > 0) {
        throw new UnrecoverableError(
          `Item ${it.id} could not be fully allocated.`,
        );
      }
    }
  }

  // 3) Build DB ops: decrement variant stocks first (from variantReservations), then combo stocks reserved
  const ops: any[] = [];
  const opsMeta: {
    type: "variant" | "combo";
    warehouseId: string;
    productVariantId?: string;
    productComboId?: string;
    qty: number;
    desc?: string;
  }[] = [];

  // variant decrements (aggregate per warehouse+variant) from variantReservations
  for (const [whId, arr] of variantReservations.entries()) {
    const variantSums = new Map<string, number>();
    for (const a of arr)
      variantSums.set(
        a.productVariantId,
        (variantSums.get(a.productVariantId) ?? 0) + a.qty,
      );
    for (const [variantId, qty] of variantSums.entries()) {
      opsMeta.push({
        type: "variant",
        warehouseId: whId,
        productVariantId: variantId,
        qty,
        desc: `warehouseStock.updateMany warehouseId=${whId} variant=${variantId} decrement=${qty}`,
      });

      ops.push(
        prisma.warehouseStock.updateMany({
          where: {
            warehouseId: whId,
            productVariantId: variantId,
            productCount: { gte: qty },
          },
          data: { productCount: { decrement: qty } },
        }),
      );
    }
  }

  // combo decrements come from comboReservedDuringAllocation (unchanged)
  for (const [whId, perWhMap] of comboReservedDuringAllocation.entries()) {
    for (const [comboId, combosReserved] of perWhMap.entries()) {
      if (combosReserved <= 0) continue;

      opsMeta.push({
        type: "combo",
        warehouseId: whId,
        productComboId: comboId,
        qty: combosReserved,
        desc: `warehouseComboStock.updateMany warehouseId=${whId} combo=${comboId} decrement=${combosReserved}`,
      });

      ops.push(
        prisma.warehouseComboStock.updateMany({
          where: {
            warehouseId: whId,
            productComboId: comboId,
            comboCount: { gte: combosReserved },
          },
          data: { comboCount: { decrement: combosReserved } },
        }),
      );
    }
  }

  // execute transaction with diagnostics
  try {
    console.log(
      "About to run prisma.$transaction with ops.length=",
      ops.length,
    );
    console.log("opsMeta (first 20):", opsMeta.slice(0, 20));

    const results = ops.length
      ? ((await prisma.$transaction(ops)) as Prisma.BatchPayload[])
      : [];

    const failed: {
      idx: number;
      meta: (typeof opsMeta)[number];
      result: Prisma.BatchPayload;
    }[] = [];
    results.forEach((r, i) => {
      if (r.count === 0) failed.push({ idx: i, meta: opsMeta[i], result: r });
    });

    if (failed.length > 0) {
      console.error(
        "Stock reservation failed for ops:",
        failed.map((f) => ({ idx: f.idx, meta: f.meta, result: f.result })),
      );
      throw new ApiError(
        httpStatus.PRECONDITION_REQUIRED,
        "Stock reservation failed due to concurrent update. Retry allocation.",
      );
    }
  } catch (err) {
    console.error("allocateAndReserve transaction / reservation error:", err);
    throw err;
  }

  // Convert allocationsForShipping map to chunks to return
  const chunks: Chunk[] = [];
  for (const [whId, arr] of allocationsForShipping.entries()) {
    chunks.push({ warehouseId: whId, items: arr });
  }
  return chunks;
};

export default allocateAndReserve;
