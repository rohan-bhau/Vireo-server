import mongoose, { Document, Schema } from "mongoose";

export interface IWebhookLog extends Document {
  workspaceId: string;
  webhookId: string;
  event: string;
  url: string;
  status: number | null;
  response: string;
  duration: number;
  createdAt: Date;
}

const webhookLogSchema = new Schema<IWebhookLog>(
  {
    workspaceId: { type: String, required: true, index: true },
    webhookId: { type: String, required: true, index: true },
    event: { type: String, required: true },
    url: { type: String, required: true },
    status: { type: Number, default: null },
    response: { type: String, default: "" },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

webhookLogSchema.index({ workspaceId: 1, createdAt: -1 });

const WebhookLog = mongoose.model<IWebhookLog>("WebhookLog", webhookLogSchema);

export default WebhookLog;
