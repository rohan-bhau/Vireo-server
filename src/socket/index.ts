import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { config } from "../config";
import { verifyAccessToken } from "../utils/token";

export function createSocketServer(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
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

  io.on("connection", (socket) => {
    socket.on("join-board", (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("leave-board", (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on("task-moved", (data: { boardId: string; taskKey: string; fromColumnId: string; toColumnId: string; position: number }) => {
      socket.to(`board:${data.boardId}`).emit("task-moved", data);
    });

    socket.on("task-updated", (data: { boardId: string; taskKey: string }) => {
      socket.to(`board:${data.boardId}`).emit("task-updated", data);
    });

    socket.on("board-updated", (boardId: string) => {
      socket.to(`board:${boardId}`).emit("board-updated", boardId);
    });

    socket.on("join-task", (taskKey: string) => {
      socket.join(`task:${taskKey}`);
    });

    socket.on("leave-task", (taskKey: string) => {
      socket.leave(`task:${taskKey}`);
    });
  });

  return io;
}
