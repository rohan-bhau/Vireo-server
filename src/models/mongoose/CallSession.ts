import mongoose, { Schema } from "mongoose";

export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "ongoing" | "ended" | "missed" | "declined";

export interface ICallSession {
  conversationId: string;
  callerId: string;
  receiverId: string;
  type: CallType;
  status: CallStatus;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  createdAt: Date;
}

const callSessionSchema = new Schema<ICallSession>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    callerId: {
      type: String,
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: ["ringing", "ongoing", "ended", "missed", "declined"],
      default: "ringing",
    },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number },
  },
  { timestamps: true }
);

callSessionSchema.index({ callerId: 1, createdAt: -1 });
callSessionSchema.index({ receiverId: 1, createdAt: -1 });

const CallSession = mongoose.model<ICallSession>("CallSession", callSessionSchema);

export default CallSession;
