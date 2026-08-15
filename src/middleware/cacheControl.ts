import { Request, Response, NextFunction } from "express";

/**
 * Express middleware to set Cache-Control headers for HTTP GET responses.
 * Helps CDNs (like Cloudflare) and client browsers cache static/semi-static API responses,
 * offloading server CPU and reducing database traffic.
 * 
 * @param maxAgeSeconds Max duration (in seconds) the response can be cached by browser/CDN. Default: 60s.
 * @param staleWhileRevalidate Max duration (in seconds) stale cache can be served while updating in background. Default: 300s.
 */
export const cacheControl = (maxAgeSeconds = 60, staleWhileRevalidate = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
      res.setHeader(
        "Cache-Control",
        `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidate}`,
      );
    }
    next();
  };
};

/**
 * Middleware to explicitly disable caching for dynamic/sensitive endpoints (e.g. auth, cart, checkout).
 */
export const noCache = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};

export default cacheControl;
