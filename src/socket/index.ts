import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { config } from "../config";
import { verifyAccessToken } from "../utils/token";
import * as conversationService from "../services/conversation";
import User from "../models/mongoose/User";

const onlineUsers = new Map<string, Set<string>>();

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

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;

    socket.join(`user:${userId}`);

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    io.emit("presence-online", { userId });

    socket.on("join-conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave-conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("send-message", async (data: {
      conversationId: string;
      content: string;
      type?: "text" | "voice" | "file";
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
    }) => {
      try {
        const message = await conversationService.createMessage({
          conversationId: data.conversationId,
          senderId: userId,
          content: data.content,
          type: data.type || "text",
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
        });

        const sender = await User.findById(userId);
        const messageObj = message.toObject();
        (messageObj as any).senderName = sender?.name || "Unknown";
        (messageObj as any).senderAvatar = sender?.avatar || null;

        io.to(`conversation:${data.conversationId}`).emit("new-message", messageObj);
      } catch (error) {
        socket.emit("message-error", { error: "Failed to send message" });
      }
    });

    socket.on("typing", (data: { conversationId: string; userId: string; userName: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing", data);
    });

    socket.on("stop-typing", (data: { conversationId: string; userId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("stop-typing", data);
    });

    socket.on("mark-read", async (data: { conversationId: string }) => {
      try {
        await conversationService.markMessagesRead(data.conversationId, userId);
        io.to(`conversation:${data.conversationId}`).emit("read-receipt", {
          conversationId: data.conversationId,
          userId,
        });
      } catch {}
    });

    // WebRTC Signaling
    socket.on("call-user", (data: {
      conversationId: string;
      receiverId: string;
      type: "audio" | "video";
      offer: any;
    }) => {
      io.to(`user:${data.receiverId}`).emit("incoming-call", {
        conversationId: data.conversationId,
        callerId: userId,
        type: data.type,
        offer: data.offer,
      });
    });

    socket.on("call-accepted", (data: {
      conversationId: string;
      callerId: string;
      answer: any;
    }) => {
      io.to(`user:${data.callerId}`).emit("call-accepted", {
        conversationId: data.conversationId,
        answer: data.answer,
      });
    });

    socket.on("call-rejected", (data: {
      conversationId: string;
      callerId: string;
    }) => {
      io.to(`user:${data.callerId}`).emit("call-rejected", {
        conversationId: data.conversationId,
      });
    });

    socket.on("ice-candidate", (data: {
      targetUserId: string;
      candidate: any;
    }) => {
      io.to(`user:${data.targetUserId}`).emit("ice-candidate", {
        candidate: data.candidate,
        from: userId,
      });
    });

    socket.on("call-ended", (data: {
      conversationId: string;
      targetUserId: string;
    }) => {
      io.to(`user:${data.targetUserId}`).emit("call-ended", {
        conversationId: data.conversationId,
        from: userId,
      });
    });

    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit("presence-offline", { userId });
        }
      }
    });
  });

  return io;
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
}
