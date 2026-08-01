import axios from "axios";
import env from "./env";

// Default timeout for Shipway requests
const SHIPWAY_TIMEOUT_MS = Number(process.env.SHIPWAY_TIMEOUT_MS || 10000);

// Configure Axios instance for Shipway API
const shipwayAxiosInstance = axios.create({
  baseURL: env.shipway.base_url,
  timeout: SHIPWAY_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
  auth: {
    username: env.shipway.username,
    password: env.shipway.password,
  },
});

export default shipwayAxiosInstance;
