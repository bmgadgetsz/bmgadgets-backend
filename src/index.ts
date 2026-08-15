import http from "http";
import app from "./app";
import env from "./config/env";
import validateDatabaseUrl from "./config/validateDatabaseUrl";
import { verifyMailTransport } from "./services/transporter.service";
import "./jobs";
import initSocketIo from "./config/socket";

const port = Number(process.env.PORT) || Number(env.app.port) || 5000;
const server = http.createServer(app);

// Bind server to 0.0.0.0 immediately for Render / Cloud container routing
server.listen(port, "0.0.0.0", () => {
  initSocketIo(server);
  // eslint-disable-next-line no-console
  console.log(`[SERVER ONLINE] Running on 0.0.0.0:${port}`);

  // Perform background validations non-blockingly
  try {
    validateDatabaseUrl(env.db.url);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[DATABASE WARNING]:", err.message || err);
  }

  verifyMailTransport().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[MAIL WARNING] Startup verification error:", err);
  });
});

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("[UNCAUGHT EXCEPTION]", error);
});

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("SIGTERM received, closing server...");
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  }
});
