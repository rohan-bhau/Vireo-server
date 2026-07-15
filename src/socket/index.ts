import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "../config";

let io: Server;

export function initializeSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const jwt = require("jsonwebtoken");
      const payload = jwt.verify(token, config.jwtAccessSecret);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${(socket as any).user?.userId}`);

    socket.on("join-board", (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("leave-board", (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on("join-issue", (issueId: string) => {
      socket.join(`issue:${issueId}`);
    });

    socket.on("leave-issue", (issueId: string) => {
      socket.leave(`issue:${issueId}`);
    });

    socket.on("join-conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave-conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${(socket as any).user?.userId}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}
