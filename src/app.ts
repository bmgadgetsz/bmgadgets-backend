import express from "express";
import cors from "cors";
import helmet from "helmet";
import xss from "xss-clean";
import morgan from "morgan";
import { status as httpStatus } from "http-status";
import ApiError from "./utils/ApiError";
import v1Router from "./routes/v1";
import corsConfig from "./config/cors";
import globalErrorHandler from "./middleware/globalErrorHandler";
import env from "./config/env";

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(xss());
app.use(morgan("dev"));
app.use(cors(env.app.nodeEnv === "development" ? undefined : corsConfig));

app.get("/", (_req, res) => {
  res.send("Hello World");
});
app.use("/api/v1", v1Router);

app.use((req) => {
  throw new ApiError(
    httpStatus.NOT_FOUND,
    `${req.method} ${req.originalUrl} not found`,
  );
});
app.use(globalErrorHandler);

export default app;
