import Conversation, { IConversation } from "../models/mongoose/Conversation";
import Message from "../models/mongoose/Message";
import User from "../models/mongoose/User";
import CallSession from "../models/mongoose/CallSession";

export async function getUserConversations(userId: string, workspaceId: string) {
  return Conversation.find({
    workspaceId,
    participants: userId,
  })
    .sort({ updatedAt: -1 })
    .lean();
}

export async function createConversation(data: {
  workspaceId: string;
  participants: string[];
  type: "group" | "dm";
  name?: string;
}) {
  const existing = await Conversation.findOne({
    workspaceId: data.workspaceId,
    type: "dm",
    participants: { $all: data.participants, $size: 2 },
  });

  if (existing) return existing;

  return Conversation.create(data);
}

export async function getConversationById(conversationId: string) {
  return Conversation.findById(conversationId);
}

export async function getConversationMessages(conversationId: string, page = 1, limit = 50) {
  return Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
}

export async function createMessage(data: {
  conversationId: string;
  senderId: string;
  content: string;
  type: "text" | "voice" | "file";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}) {
  const message = await Message.create(data);

  const sender = await User.findById(data.senderId);

  await Conversation.findByIdAndUpdate(data.conversationId, {
    lastMessage: {
      content: data.content,
      senderId: data.senderId,
      senderName: sender?.name || "Unknown",
      createdAt: new Date(),
    },
    updatedAt: new Date(),
  });

  return message;
}

export async function markMessagesRead(conversationId: string, userId: string) {
  await Message.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
}

export async function getUnreadCount(conversationId: string, userId: string) {
  return Message.countDocuments({
    conversationId,
    senderId: { $ne: userId },
    readBy: { $ne: userId },
  });
}

export async function addMember(conversationId: string, userId: string) {
  return Conversation.findByIdAndUpdate(
    conversationId,
    { $addToSet: { participants: userId } },
    { new: true }
  );
}

export async function removeMember(conversationId: string, userId: string) {
  return Conversation.findByIdAndUpdate(
    conversationId,
    { $pull: { participants: userId } },
    { new: true }
  );
}

export async function createCallSession(data: {
  conversationId: string;
  callerId: string;
  receiverId: string;
  type: "audio" | "video";
}) {
  return CallSession.create(data);
}

export async function updateCallStatus(callId: string, status: string, endTime?: Date) {
  const update: any = { status };
  if (endTime) {
    update.endTime = endTime;
  }
  if (status === "ongoing") {
    update.startTime = new Date();
  }
  if (status === "ended" || status === "missed" || status === "declined") {
    const call = await CallSession.findById(callId);
    if (call?.startTime && !endTime) {
      update.endTime = new Date();
    }
  }
  return CallSession.findByIdAndUpdate(callId, update, { new: true });
}

export async function getCallHistory(userId: string, limit = 20) {
  return CallSession.find({
    $or: [{ callerId: userId }, { receiverId: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
