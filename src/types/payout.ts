import { VendorPayoutStatus } from "@/generated/prisma";

/**
 * Represents a single row in a payout report.
 */
export type PayoutRow = {
  productName: string;
  orderCode: string;
  salePrice: number;
  commission: number;
  gst: number;
  netToVendor: number;
};

/**
 * Data Transfer Object for the latest payout information.
 */
export type LatestPayoutDTO = {
  payoutId: string;
  cycleStart: Date;
  cycleEnd: Date;
  status: VendorPayoutStatus;
  rows: PayoutRow[];
  totals: {
    salePrice: number;
    commission: number;
    gst: number;
    netToVendor: number;
    marketFeeShare?: number;
  };
};
