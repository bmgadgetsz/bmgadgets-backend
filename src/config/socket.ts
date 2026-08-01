import { validateSessionToken } from "@/modules/auth/auth.service";
import ApiError from "@/utils/ApiError";
import { Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import corsConfig from "./cors";
import env from "./env";

let io: SocketIOServer;

/**
 * Initializes the Socket.IO server with authentication middleware and connection handlers.
 * @param server - The HTTP server instance to attach the Socket.IO server to.
 */
export const initSocketIo = (server: Server) => {
  io = new SocketIOServer(server, {
    cors: env.app.nodeEnv === "development" ? { origin: "*" } : corsConfig,
  });

  // Authentication middleware to validate session token
  io.use(async (socket, next) => {
    const { token } = socket.handshake.auth as { token?: string };
    if (!token) {
      return next(new Error("Authentication error: token required"));
    }

    try {
      const { session, user } = await validateSessionToken(token);
      if (!session) {
        return next(new Error("Authentication error: session not found"));
      }
      if (!user) {
        return next(new Error("Authentication error: user not found"));
      }

      // Attach session and employee data to the socket

      // eslint-disable-next-line no-param-reassign
      socket.data.session = session;
      // eslint-disable-next-line no-param-reassign
      socket.data.user = user;
      return next();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `Authentication error: ${err.message}`
          : "Authentication error: invalid token";
      return next(new Error(msg));
    }
  });

  // Connection handler for new socket connections
  io.on("connection", (socket) => {
    const empId = socket.data.user.id as string;

    // Log the connection of a new employee

    // eslint-disable-next-line no-console
    console.log("A new user connected:", empId);
    // Make the employee join their own room for personalized notifications
    socket.join(empId);

    // Handle disconnection of the socket
    socket.on("disconnect", () => {
      // eslint-disable-next-line no-console
      console.log("User disconnected:", empId);
    });
  });

  // Log that the socket server is running

  // eslint-disable-next-line no-console
  console.log("Socket server running");
};

/**
 * Retrieves the initialized Socket.IO instance.
 * @returns The Socket.IO server instance.
 * @throws Will throw an error if the Socket.IO server is not initialized.
 */
export const getIO = (): SocketIOServer => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

export default initSocketIo;
