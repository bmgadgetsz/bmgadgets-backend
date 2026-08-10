import { configDotenv } from "dotenv";

// Load environment variables from a .env file into process.env
configDotenv();
/**
 * This file contains all the major envs used throughout this project
 */

const env = {
  // App envs
  app: {
    // Application configuration
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    superadminEmail: process.env.SUPERADMIN_EMAIL || "superadmin@bmq.com",
    seedVendorEmail:
      process.env.ORIGINO_VENDOR_EMAIL || "vendor-seed@example.com",
    seedVendorPhone: process.env.ORIGINO_VENDOR_PHONE || "0000000000",
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || "http://localhost:3000",
    vendorPanelBaseUrl:
      process.env.VENDOR_PANEL_URL || "https://origino-vendor-dev.vercel.app",
    lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD) || 10,
  },
  // database envs
  db: {
    // Database configuration
    url: process.env.DATABASE_URL,
    testUrl: process.env.TEST_DATABASE_URL,
  },
  // aws envs
  aws: {
    // AWS / Cloudflare R2 configuration
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION,
    s3bucketName: process.env.AWS_S3_BUCKET_NAME,
    s3Endpoint: process.env.S3_ENDPOINT,
    s3PublicUrl: process.env.S3_PUBLIC_URL,
  },
  // envs for sending mails
  email: {
    // Email configuration for sending emails
    user: process.env.EMAIL_USER,

    pass: process.env.EMAIL_PASS,
  },
  // envs for razorpay payments
  razorpay: {
    // Razorpay configuration for payments
    keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "your_secret",
  },
  // envs for razorpayx payouts
  razorpayx: {
    // RazorpayX configuration for payouts
    keyId: process.env.RAZORPAYX_KEY_ID!,
    keySecret: process.env.RAZORPAYX_KEY_SECRET!,
    accountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER!, // needed for payouts
    webhook_secret: process.env.RAZORPAYX_WEBHOOK_SECRET!,
  },
  // envs for shipways service
  shipway: {
    // Shipway configuration for shipping
    username: process.env.SHIPWAY_USERNAME!,
    password: process.env.SHIPWAY_LICENSE_KEY!,
    base_url: process.env.SHIPWAY_BASE_URL!,
    webhook_secret: process.env.SHIPWAY_WEBHOOK_SECRET!,
  },
  // envs for sms service of msg91
  message91: {
    // Message91 configuration for SMS
    authKey: process.env.M91_AUTH_KEY!,
    senderId: process.env.M91_NAME!,
    phoneNo: process.env.M91_PHONE_NO!,
  },
};

export default env;
