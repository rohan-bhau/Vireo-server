import mongoose, { Schema } from "mongoose";

export type NotificationType = "assigned" | "mentioned" | "status_changed" | "commented";

export interface INotification {
  userId: string;
  type: NotificationType;
  taskId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["assigned", "mentioned", "status_changed", "commented"],
      required: true,
    },
    taskId: {
      type: String,
      required: true,
    },
    taskTitle: {
      type: String,
      required: true,
    },
    actorId: {
      type: String,
      required: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
