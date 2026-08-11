/**
 * CORS configuration for the application.
 * Specifies the allowed origins, headers, and credentials policy.
 */
const extraOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [];

const staticAllowed = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
  "https://origino-admin-dev.vercel.app",
  "https://origino-vendor-dev.vercel.app",
  "https://origino-dev.vercel.app",
  "https://origino-admin-staging.vercel.app",
  "https://origino-vendor-staging.vercel.app",
  "https://origino-staging.vercel.app",
  "https://main.d1qaf46koue5ec.amplifyapp.com",
  "https://main.d2fn4nzp62s4wl.amplifyapp.com",
  "https://main.d3fxpi71jac1s.amplifyapp.com",
  ...extraOrigins,
];

const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
    if (!origin) return callback(null, true);

    if (
      staticAllowed.includes(origin) ||
      origin.endsWith(".onrender.com") ||
      origin.endsWith(".vercel.app") ||
      origin.endsWith(".amplifyapp.com") ||
      process.env.ALLOWED_ORIGINS === "*"
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

export default corsConfig;
