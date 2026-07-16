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

    socket.on("issue-moved", (data: { boardId: string; issueId: string; fromColumnId: string; toColumnId: string; position: number }) => {
      socket.to(`board:${data.boardId}`).emit("issue-moved", data);
    });

    socket.on("board-updated", (boardId: string) => {
      socket.to(`board:${boardId}`).emit("board-updated", boardId);
    });
  });

  return io;
}
