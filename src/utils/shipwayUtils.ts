// src/utils/shipwayOrderId.ts
import { createHash } from "crypto";

/**
 * Build deterministic, short Shipway order id.
 *
 * Inputs should be the *exact* values used in worker: orderId, vendorId (or "platform"), warehouseId (or "origin"), chunkIndex (number).
 *
 * Returns short id like: "sw-1a2b3c4d5e6f" (prefix optional)
 */
// eslint-disable-next-line
export function buildShipwayOrderId({
  orderId,
  vendorId,
  warehouseId,
  chunkIndex,
  prefix = "sw",
  hashLen = 12, // hex chars (12 -> 48 bits). Use 16 for 64 bits if you prefer.
}: {
  orderId: string;
  vendorId: string | null;
  warehouseId: string | null;
  chunkIndex: number;
  prefix?: string | null;
  hashLen?: number;
}) {
  const vendorSuffix = vendorId ?? "platform";
  const warehouseSuffix = warehouseId ?? "origin";
  const base = `${orderId}|${vendorSuffix}|${warehouseSuffix}|${chunkIndex}`;

  const fullHash = createHash("sha256").update(base).digest("hex");
  const short = fullHash.slice(0, hashLen);

  return prefix ? `${prefix}-${short}` : short;
}
