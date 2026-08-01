import { razorpayx } from "@/config/razorpay";
import { VendorProfile } from "@/generated/prisma";
import { v4 as uuidv4 } from "uuid";

export async function createContact(
  vendor: VendorProfile,
  vendorName: string,
  type: string,
) {
  const res = await razorpayx.post("/contacts", {
    name: vendorName,
    email: vendor.email,
    contact: vendor.mobileNumber,
    type,
    reference_id: vendor?.id,
  });
  return res.data;
}

export async function updateContact(
  id: string,
  vendor: VendorProfile,
  vendorName: string,
  type: string,
) {
  const res = await razorpayx.patch(`/contacts/${id}`, {
    name: vendorName,
    email: vendor.email,
    contact: vendor.mobileNumber,
    type,
    reference_id: vendor?.id,
    notes: {
      updatedAt: vendor?.updatedAt,
    },
  });
  return res.data;
}

export async function createFundAccount(
  contactId: string,
  accountHolderName: string,
  bankIfsc: string,
  bankAccountNumber: string,
) {
  const res = await razorpayx.post("/fund_accounts", {
    contact_id: contactId,
    account_type: "bank_account",
    bank_account: {
      name: accountHolderName, // Bank account holder name
      ifsc: bankIfsc,
      account_number: bankAccountNumber,
    },
  });
  return res.data;
}

export async function createPayout(
  fundAccountId: string,
  amount: number,
  meta: { vendorId: string; vendorPayoutId: string },
  idempotencyKey?: string,
  mode: string = "IMPS",
) {
  // If not provided, generate new one
  const key = idempotencyKey || uuidv4();
  const res = await razorpayx.post(
    "/payouts",
    {
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER, // your virtual account no.
      fund_account_id: fundAccountId,
      amount: Math.round(amount * 100), // convert to paise
      currency: "INR",
      mode,
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: `payout-${meta.vendorPayoutId}`,
      narration: `BMGadgets Test Payout`,
      notes: {
        vendor_id: meta.vendorId,
        vendor_payout_id: meta.vendorPayoutId,
      },
    },
    {
      headers: {
        "X-Payout-Idempotency": key,
      },
    },
  );
  return res.data;
}
