import express from "express";
import cors from "cors";
import helmet from "helmet";
import xss from "xss-clean";
import morgan from "morgan";
import path from "path";
import { status as httpStatus } from "http-status";
import ApiError from "./utils/ApiError";
import v1Router from "./routes/v1";
import corsConfig from "./config/cors";
import globalErrorHandler from "./middleware/globalErrorHandler";
import env from "./config/env";

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(xss());
app.use(morgan("dev"));
app.use(cors(env.app.nodeEnv === "development" ? undefined : corsConfig));

app.get("/", (_req, res) => {
  res.send("Hello World");
});
app.get("/health", (_req, res) => {
  res.status(httpStatus.OK).json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/api/v1", v1Router);

// Serve Admin Panel Static Assets
app.use("/admin", express.static(path.join(process.cwd(), "public/admin")));
app.get("/admin/*", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public/admin", "index.html"));
});

app.use((req) => {
  throw new ApiError(
    httpStatus.NOT_FOUND,
    `${req.method} ${req.originalUrl} not found`,
  );
});
app.use(globalErrorHandler);

export default app;
