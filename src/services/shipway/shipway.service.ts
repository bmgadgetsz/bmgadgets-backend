import prisma from "@/config/prisma";
import shipwayAxiosInstance from "@/config/shipway";
import ApiError from "@/utils/ApiError";
import axios, { AxiosError, AxiosResponse } from "axios";
import { status as httpStatus } from "http-status";

// const SHIPWAY_BASE = process.env.SHIPWAY_BASE || "https://api.shipway.in";
// const SHIPWAY_API_KEY = process.env.SHIPWAY_API_KEY || "";

function sleep(ms: number) {
  // eslint-disable-next-line
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * sendPushOrderToShipway
 * - payload: mapped payload
 * - opts: { idempotencyKey, maxRetries }
 *
 * Returns { success: boolean, data?, error? }
 */
const sendPushOrderToShipway = async (
  // eslint-disable-next-line
  payload: any,
  opts: { idempotencyKey?: string; maxRetries?: number } = {},
) => {
  const maxRetries = opts.maxRetries ?? 1;
  let attempt = 0;
  // eslint-disable-next-line
  let lastErr: any = null;

  while (attempt < maxRetries) {
    try {
      const headers: Record<string, string> = {};
      if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
      // eslint-disable-next-line
      const resp = await shipwayAxiosInstance.post("/v2orders", payload, {
        headers,
      });
      // eslint-disable-next-line
      console.log("Shipway push order api response: ", resp.data);
      return {
        success: resp.data.success,
        status: resp.status,
        data: resp.data,
      };
      // eslint-disable-next-line
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      const shouldRetry = !status || status >= 500;
      attempt += 1;
      if (!shouldRetry || attempt > maxRetries) break;
      const delay = Math.min(
        30000,
        2 ** attempt * 1000 + Math.floor(Math.random() * 500),
      );
      // eslint-disable-next-line
      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastErr?.response?.data ?? lastErr?.message ?? String(lastErr),
  };
};
// eslint-disable-next-line
const createWarehouseOnShipway = async (payload: Record<string, any>) => {
  try {
    const resp = await shipwayAxiosInstance.post("/warehouse/", payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("Shipway API raw response:", resp.data);

    const { data } = resp;
    const shipwayWarehouseId = data?.warehouse_response?.warehouse_id
      ? String(data.warehouse_response.warehouse_id)
      : null;

    return {
      success: true,
      status: resp.status,
      data,
      message: data?.message ?? null,
      shipwayWarehouseId, // easy to use downstream
    };
    // eslint-disable-next-line
  } catch (err: any) {
    // 🔥 log the entire error object for debugging
    console.error("Shipway API error:", {
      status: err?.response?.status,
      headers: err?.response?.headers,
      data: err?.response?.data,
      message: err?.message,
    });
    return {
      success: false,
      status: err?.response?.status ?? 500,
      error: err?.response?.data ?? err?.message ?? String(err),
    };
  }
};

export type ShipwayCancelResultItem = {
  order_id: string;
  error: boolean;
  success: boolean;
  message?: string;
};

export type ShipwayCancelResponse = ShipwayCancelResultItem[];

/**
 * cancelOrdersOnShipway
 * - orderIds: array of merchant order ids (strings) that were used when pushing orders to Shipway.
 * - One-shot call (no retries). Returns Shipway's per-order response or an error object.
 */
const cancelOrdersOnShipway = async (
  orderIds: string[],
): Promise<{
  success: boolean;
  status?: number;
  data?: ShipwayCancelResponse;
  // eslint-disable-next-line
  error?: any;
}> => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { success: false, error: "orderIds must be a non-empty array" };
  }

  const payload = { order_ids: orderIds };

  try {
    const resp = await shipwayAxiosInstance.post("/Cancelorders/", payload, {
      headers: { "Content-Type": "application/json" },
    });

    // According to your example, Shipway returns an array of { order_id, error, success, message }
    const data = resp.data as ShipwayCancelResponse;

    return {
      success: true,
      status: resp.status,
      data,
    };
    // eslint-disable-next-line
  } catch (err: any) {
    // Normalize error object so callers can inspect it
    const status = err?.response?.status;
    const responseData = err?.response?.data ?? null;
    const message = err?.message ?? String(err);

    return {
      success: false,
      status,
      error: responseData ?? message,
    };
  }
};

export type ShipwayCancelShipmentResponse = {
  error: boolean;
  success: boolean;
  message: string;
  invalid_tracking_numbers?: string;
  shipment_success_tracking_numbers?: string;
  shipment_failed_tracking_numbers?: string;
};

/**
 * cancelShipmentOnShipway
 * - awbNumbers: array of AWB numbers to cancel.
 * - One-shot (no retries).
 */
const cancelShipmentOnShipway = async (
  awbNumbers: string[],
): Promise<{
  success: boolean;
  status?: number;
  data?: ShipwayCancelShipmentResponse;
  // eslint-disable-next-line
  error?: any;
}> => {
  if (!Array.isArray(awbNumbers) || awbNumbers.length === 0) {
    return { success: false, error: "awbNumbers must be a non-empty array" };
  }

  const payload = { awb_number: awbNumbers };

  try {
    const resp = await shipwayAxiosInstance.post("/Cancel/", payload, {
      headers: { "Content-Type": "application/json" },
    });

    const data = resp.data as ShipwayCancelShipmentResponse;

    return {
      success: true,
      status: resp.status,
      data,
    };
    // eslint-disable-next-line
  } catch (err: any) {
    const status = err?.response?.status;
    const responseData = err?.response?.data ?? null;
    const message = err?.message ?? String(err);

    return {
      success: false,
      status,
      error: responseData ?? message,
    };
  }
};

/**
 * createPickupOnShipway
 * - Creates a pickup request on Shipway
 * - One-shot (no retries).
 */
export interface ShipwayCreatePickupResponse {
  success: boolean;
  message: string;
  awb_response?: {
    success: boolean;
    message: string;
    AWB: string;
    carrier_id: string;
    shipping_url: string;
  };
}
const createPickupOnShipway = async (payload: {
  pickup_date: string; // e.g., "2019-10-16"
  pickup_time: string; // e.g., "14:30"
  office_close_time: string; // e.g., "18:00"
  package_count: string; // e.g., "1"
  carrier_id: string; // e.g., "1"
  warehouse_id: string; // e.g., "5163"
  return_warehouse_id: string; // e.g., "1"
  payment_type: string; // e.g., "C"
  order_ids: string[]; // e.g., ["1002", "10757958"]
}): Promise<{
  success: boolean;
  status?: number;
  data?: ShipwayCreatePickupResponse;
  // eslint-disable-next-line
  error?: any;
}> => {
  try {
    const resp = await shipwayAxiosInstance.post("/createpickup/", payload, {
      headers: { "Content-Type": "application/json" },
    });

    const data = resp.data as ShipwayCreatePickupResponse;

    return {
      success: true,
      status: resp.status,
      data,
    };
    // eslint-disable-next-line
  } catch (err: any) {
    const status = err?.response?.status;
    const responseData = err?.response?.data ?? null;
    const message = err?.message ?? String(err);

    return {
      success: false,
      status,
      error: responseData ?? message,
    };
  }
};

const sendCreateReturnToShipway = async (
  payload: Record<string, unknown>,
): Promise<{
  success: boolean;
  status?: number;
  data?: unknown;
  error?: unknown;
  rma_no?: string | null;
  awb?: string | null;
}> => {
  try {
    const resp: AxiosResponse = await shipwayAxiosInstance.post(
      "/Createreturns",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        // no retries, no idempotency header per your requirement
      },
    );

    console.log(resp.data);

    // eslint-disable-next-line
    const data = resp.data as any;

    // Shipway sometimes nests response inside create_return_response
    const nested = data?.create_return_response;
    console.log("Nested response:", nested);
    const ok =
      (typeof nested?.success !== "undefined" &&
        Number(nested.success) === 1) ||
      (typeof data?.success !== "undefined" && Number(data.success) === 1);

    // eslint-disable-next-line
    const rma_no = nested?.rma_no ?? null;
    const awb = data?.awb_response.AWB ?? null;

    if (ok) {
      // eslint-disable-next-line
      return { success: true, status: resp.status, data, rma_no, awb };
    }

    // business-level failure (don't retry)
    return {
      success: false,
      status: resp.status,
      data,
      error: data?.message ?? "Shipway returned non-success",
      // eslint-disable-next-line
      rma_no,
      awb,
    };
    // eslint-disable-next-line
  } catch (err: any) {
    // network / axios error - single shot: return failure for manual retry
    const status = err?.response?.status;
    const responseData = err?.response?.data;

    return {
      success: false,
      status,
      data: responseData,
      error: responseData ?? err?.message ?? String(err),
      rma_no: null,
    };
  }
};

// Helper: normalize reason text for caching & dedupe
function normalizeReasonText(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * ensureReturnReasonExists
 * - Checks DB cache (if Prisma model ReturnReason exists)
 * - If not found, calls external API to create it and saves mapping
 * - Returns external id as string
 */
const ensureReturnReasonExists = async (
  reasonText: string,
): Promise<string | undefined> => {
  const norm = normalizeReasonText(reasonText);

  // If you added the ReturnReason Prisma model, check cache first
  try {
    const cached = await prisma.returnReason.findUnique({
      where: { reasonText: norm },
    });
    if (cached) return cached.externalId;
  } catch (err) {
    // If prisma model doesn't exist, continue to create via external API
    // but don't crash — log
    console.debug("ReturnReason cache not available or query error", err);
  }

  // Call external API to create reason
  try {
    const reqBody = { reason: reasonText };
    // NOTE: your actual endpoint/auth might differ; adjust headers if needed
    const resp = await shipwayAxiosInstance.post("/Getreturnreasons", reqBody, {
      timeout: 10000,
    });

    console.log(resp);

    const { data } = resp;
    if (!data.id) {
      if (!data || data.error) {
        throw new Error(
          `Failed to create return reason: ${JSON.stringify(data)}`,
        );
      }
    }

    const externalId = String(data.id);

    // Save in cache if Prisma model available
    try {
      await prisma.returnReason.create({
        data: {
          reasonText: norm,
          externalId,
        },
      });
    } catch (dbErr) {
      // If unique constraint occurs due to race, do a safe upsert
      try {
        await prisma.returnReason.upsert({
          where: { reasonText: norm },
          update: { externalId },
          create: { reasonText: norm, externalId },
        });
      } catch (upsertErr) {
        console.debug("ReturnReason cache upsert failed", upsertErr);
      }
    }

    return externalId;
  } catch (err: any) {
    return undefined;
  }
};

/**
 * Cancel a return shipment in Shipway
 *
 * @param rmaNo Shipway's RMA number (e.g., "702.TESTJAN001-E")
 * @param orderId Your order ID in Shipway (e.g., "TESTJAN001")
 */
const cancelReturnShipment = async (
  rmaNo: string,
  orderId: string,
): Promise<any> => {
  try {
    const response = await shipwayAxiosInstance.post("/Cancelreturnshipment/", {
      rma_no: rmaNo,
      order_id: orderId,
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "Error cancelling return shipment:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

export interface CarrierRate {
  carrier_id: number;
  courier_name: string;
  delivery_charge: number;
  rto_charge: number;
  charged_weight: number;
  zone: number;
}

export interface CarrierRatesResponse {
  success: string;
  rate_card: CarrierRate[];
}

const getShipwayCarrierRates = async (
  fromPincode: string,
  toPincode: string,
  paymentType: "prepaid" | "cod",
) => {
  const { data } = await shipwayAxiosInstance.get<CarrierRatesResponse>(
    `/getshipwaycarrierrates`,
    {
      params: {
        fromPincode,
        toPincode,
        paymentType,
      },
    },
  );
  return data.rate_card;
};

export interface ServiceableCarrier {
  carrier_id: string;
  name: string;
  carrier_title: string;
  payment_type: "P" | "C"; // P = Prepaid, C = COD
}

export interface PincodeServiceableResponse {
  success: number;
  error: string;
  message: ServiceableCarrier[];
}

const getPincodeServiceable = async (
  pincode: string,
  paymentType?: "P" | "C",
) => {
  try {
    console.log("HEYYYY");
    const { data } = await shipwayAxiosInstance.get<PincodeServiceableResponse>(
      `/pincodeserviceable`,
      {
        params: {
          pincode,
          ...(paymentType ? { payment_type: paymentType } : {}),
        },
      },
    );
    console.log(data);
    return data.message;
  } catch (err) {
    console.log(err);
    return [];
  }
};

export type GetCarriers = {
  id: string;
  name: string;
  reverse_status: boolean;
  ndr_status: boolean;
  aggregator_carrier: boolean;
  carrier_title: string;
};

const getCarriers = async (): Promise<GetCarriers[]> => {
  const res = await shipwayAxiosInstance.get("/getcarrier");
  const { data } = res;
  return data.message;
};

// utility: pick single random element or null
function pickRandom<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Choose a random reverse-capable carrier that is serviceable for the given pincode.
 *
 * @param carriers - full list from shipwayService.getCarriers()
 * @param pincode - order.address.zipcode
 * @param requiredPaymentType - optional "P" | "C" to require carriers that support that payment type
 *                              (if omitted, will not filter by payment type)
 */
const chooseRandomReverseCarrierForPincode = async (
  carriers: GetCarriers[],
  pincode: string,
  requiredPaymentType?: "P" | "C",
): Promise<GetCarriers | null> => {
  // fetch serviceable carriers for pincode (your API call)
  const serviceable: ServiceableCarrier[] =
    await shipwayService.getPincodeServiceable(pincode);

  if (!Array.isArray(serviceable) || serviceable.length === 0) {
    // nothing serviceable for this pincode
    return null;
  }

  // build fast lookup: carrier_id -> payment_type (if multiple entries exist, last wins or you can prefer one)
  const svcMap = new Map<string, ServiceableCarrier>();
  for (const s of serviceable) svcMap.set(s.carrier_id, s);

  // filter Shipway carriers by reverse support and serviceability (and optional payment_type)
  const candidates = carriers.filter((c) => {
    if (!c.reverse_status) return false; // must support reverse
    const svc = svcMap.get(c.id);
    if (!svc) return false; // not serviceable for this pincode
    if (requiredPaymentType && svc.payment_type !== requiredPaymentType)
      return false; // payment_type check
    return true;
  });

  return pickRandom(candidates);
};

const shipwayService = {
  sendPushOrderToShipway,
  createWarehouseOnShipway,
  cancelOrdersOnShipway,
  cancelShipmentOnShipway,
  createPickupOnShipway,
  sendCreateReturnToShipway,
  ensureReturnReasonExists,
  cancelReturnShipment,
  getShipwayCarrierRates,
  getPincodeServiceable,
  getCarriers,
  chooseRandomReverseCarrierForPincode,
};

export default shipwayService;
