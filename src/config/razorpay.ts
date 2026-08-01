import Razorpay from "razorpay";
import axios from "axios";
import env from "./env";

// Razorpay instance for customer payments
const razorpayInstance = new Razorpay({
  key_id: env.razorpay.keyId,
  key_secret: env.razorpay.keySecret,
});

// RazorpayX (payouts) instance for vendor payouts
export const razorpayx = axios.create({
  baseURL: "https://api.razorpay.com/v1", // Base URL for both test and live environments
  auth: {
    username: env.razorpayx.keyId, // key_id
    password: env.razorpayx.keySecret, // key_secret
  },
});

export default razorpayInstance;
