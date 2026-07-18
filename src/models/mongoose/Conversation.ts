import mongoose, { Schema } from "mongoose";

export type ConversationType = "group" | "dm";

export interface IConversation {
  workspaceId: string;
  participants: string[];
  type: ConversationType;
  name?: string;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length >= 2,
        message: "Conversation must have at least 2 participants",
      },
    },
    type: {
      type: String,
      enum: ["group", "dm"],
      required: true,
    },
    name: {
      type: String,
    },
    lastMessage: {
      content: { type: String },
      senderId: { type: String },
      senderName: { type: String },
      createdAt: { type: Date },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ workspaceId: 1, updatedAt: -1 });

const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);

export default Conversation;
