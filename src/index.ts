import http from "http";
import app from "./app";
import env from "./config/env";
import validateDatabaseUrl from "./config/validateDatabaseUrl";
import { verifyMailTransport } from "./services/transporter.service";
import "./jobs";
import initSocketIo from "./config/socket";

validateDatabaseUrl(env.db.url);
verifyMailTransport().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[MAIL] Startup verification error:", err);
});

const server = http.createServer(app);

const exitHandler = (error: Error) => {
  // eslint-disable-next-line no-console
  console.log("[SERVER ERROR]", error);
  if (server) server.close();
  process.exit(1);
};

process.on("uncaughtException", exitHandler);
process.on("unhandledRejection", exitHandler);
process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("SIGTERM received");
  if (server) server.close();
});

server.listen(env.app.port, () => {
  initSocketIo(server);
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${env.app.port}`);
});
