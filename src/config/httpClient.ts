import http from "http";
import https from "https";
import axios from "axios";

// Create persistent keep-alive agents to reuse TCP/TLS connections
// Reduces network latency by 100-300ms per outbound request
export const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 10000,
});

export const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 10000,
});

/**
 * Shared, performance-optimized Axios HTTP client with persistent connection pooling
 */
export const httpClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 10000, // 10s default timeout to prevent thread blocking
});

export default httpClient;
