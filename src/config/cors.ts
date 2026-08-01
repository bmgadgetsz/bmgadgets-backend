/**
 * CORS configuration for the application.
 * Specifies the allowed origins, headers, and credentials policy.
 */
const corsConfig = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    // Development environments
    "https://origino-admin-dev.vercel.app",
    "https://origino-vendor-dev.vercel.app",
    "https://origino-dev.vercel.app",
    // Staging environments
    "https://origino-admin-staging.vercel.app",
    "https://origino-vendor-staging.vercel.app",
    "https://origino-staging.vercel.app",
    // Production environments
    "https://main.d1qaf46koue5ec.amplifyapp.com",
    "https://main.d2fn4nzp62s4wl.amplifyapp.com",
    "https://main.d3fxpi71jac1s.amplifyapp.com",
  ],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

export default corsConfig;
