import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"], // for prisma
  outDir: "build",
  target: "node18",
  tsconfig: "tsconfig.json",
  clean: true,
  noExternal: [
    "compression",
    "express",
    "cors",
    "helmet",
    "morgan",
    "http-status",
    "express-rate-limit",
    "axios",
    "multer",
    "nodemailer",
    "razorpay",
    "socket.io",
    "cheerio",
    "date-fns",
    "uuid",
    "node-cron",
    "dotenv",
    "zod",
    "@oslojs/crypto",
    "@oslojs/encoding",
    "xss-clean"
  ],
  external: ["@prisma/client", "prisma", "@node-rs/argon2", "bullmq", "ioredis", "@aws-sdk/client-s3"]
});
