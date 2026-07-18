import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as conversationService from "../services/conversation";
import User from "../models/mongoose/User";
import { AppError } from "../utils/AppError";

function asString(val: unknown): string {
  if (Array.isArray(val)) return String(val[0]);
  if (typeof val === "object" && val !== null) return "";
  return String(val || "");
}

export async function getConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = asString(req.params.conversationId);
    const conversation = await conversationService.getConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }
    if (!conversation.participants.includes(req.userId!)) {
      throw new AppError("Not a participant of this conversation", 403);
    }
    const unreadCount = await conversationService.getUnreadCount(conversationId, req.userId!);
    res.status(200).json({ status: "success", data: { conversation: { ...conversation.toObject(), unreadCount } } });
  } catch (error) {
    next(error);
  }
}

export async function getConversations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = asString(req.params.workspaceId);
    const conversations = await conversationService.getUserConversations(req.userId!, workspaceId);
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await conversationService.getUnreadCount(conv._id.toString(), req.userId!);
        return { ...conv, unreadCount };
      })
    );
    res.status(200).json({ status: "success", data: { conversations: conversationsWithUnread } });
  } catch (error) {
    next(error);
  }
}

export async function createConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { workspaceId, participantIds, name } = req.body;
    if (!workspaceId || !participantIds || !Array.isArray(participantIds) || participantIds.length < 1) {
      throw new AppError("Workspace ID and at least one participant are required", 400);
    }

    const allParticipants = [req.userId!, ...participantIds.filter((id: string) => id !== req.userId!)];
    const type = allParticipants.length === 2 ? "dm" : "group";

    const conversation = await conversationService.createConversation({
      workspaceId,
      participants: allParticipants,
      type,
      name: name || undefined,
    });

    res.status(201).json({ status: "success", data: { conversation } });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = asString(req.params.conversationId);
    const page = parseInt(asString(req.query.page)) || 1;
    const limit = parseInt(asString(req.query.limit)) || 50;

    const conversation = await conversationService.getConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }
    if (!conversation.participants.includes(req.userId!)) {
      throw new AppError("Not a participant of this conversation", 403);
    }

    const messages = await conversationService.getConversationMessages(conversationId, page, limit);

    res.status(200).json({
      status: "success",
      data: { messages: messages.reverse(), hasMore: messages.length === limit },
    });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = asString(req.params.conversationId);
    const { content, type, fileUrl, fileName, fileSize } = req.body;

    const conversation = await conversationService.getConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }
    if (!conversation.participants.includes(req.userId!)) {
      throw new AppError("Not a participant of this conversation", 403);
    }

    const message = await conversationService.createMessage({
      conversationId,
      senderId: req.userId!,
      content: content || "",
      type: type || "text",
      fileUrl,
      fileName,
      fileSize,
    });

    const populated = await User.findById(req.userId!);
    const messageObj = message.toObject();
    (messageObj as any).senderName = populated?.name || "Unknown";
    (messageObj as any).senderAvatar = populated?.avatar || null;

    res.status(201).json({ status: "success", data: { message: messageObj } });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = asString(req.params.conversationId);
    await conversationService.markMessagesRead(conversationId, req.userId!);
    res.status(200).json({ status: "success" });
  } catch (error) {
    next(error);
  }
}

export async function getOrCreateDMConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { workspaceId, userId: otherUserId } = req.body;
    if (req.userId! === otherUserId) {
      throw new AppError("Cannot create DM with yourself", 400);
    }

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      throw new AppError("User not found", 404);
    }

    const conversation = await conversationService.createConversation({
      workspaceId,
      participants: [req.userId!, otherUserId],
      type: "dm",
    });

    res.status(200).json({ status: "success", data: { conversation } });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = asString(req.params.conversationId);
    const { userId } = req.body;

    const conversation = await conversationService.getConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }
    if (!conversation.participants.includes(req.userId!)) {
      throw new AppError("Not a participant of this conversation", 403);
    }

    const updated = await conversationService.addMember(conversationId, userId);
    res.status(200).json({ status: "success", data: { conversation: updated } });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const conversationId = asString(req.params.conversationId);
    const userId = asString(req.params.userId);

    const conversation = await conversationService.getConversationById(conversationId);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }
    if (!conversation.participants.includes(req.userId!)) {
      throw new AppError("Not a participant of this conversation", 403);
    }

    const updated = await conversationService.removeMember(conversationId, userId);
    res.status(200).json({ status: "success", data: { conversation: updated } });
  } catch (error) {
    next(error);
  }
}

export async function getCallHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const calls = await conversationService.getCallHistory(req.userId!);
    res.status(200).json({ status: "success", data: { calls } });
  } catch (error) {
    next(error);
  }
}
