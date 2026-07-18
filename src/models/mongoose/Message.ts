import mongoose, { Schema } from "mongoose";

export type MessageType = "text" | "voice" | "file";

export interface IMessage {
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  readBy: string[];
  editedAt?: Date;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "voice", "file"],
      default: "text",
    },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    readBy: {
      type: [String],
      default: [],
    },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model<IMessage>("Message", messageSchema);

export default Message;
