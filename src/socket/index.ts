import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { config } from "../config";
import { verifyAccessToken } from "../utils/token";

export function getIO(): Server | null {
  return (globalThis as any).__io || null;
}

export function createSocketServer(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  (globalThis as any).__io = io;

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;

    socket.join(`user:${userId}`);

    socket.on("join-board", async (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("leave-board", async (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on("join-workspace", async (workspaceId: string) => {
      socket.join(`workspace:${workspaceId}`);
    });

    socket.on("leave-workspace", async (workspaceId: string) => {
      socket.leave(`workspace:${workspaceId}`);
    });
  });

  return io;
}
