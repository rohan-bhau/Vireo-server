import mongoose, { Schema } from "mongoose";

export type NotificationType =
  | "assigned"
  | "mentioned"
  | "status_changed"
  | "commented"
  | "issue_created"
  | "issue_updated"
  | "issue_deleted"
  | "sprint_started"
  | "sprint_completed";

export interface INotification {
  userId: string;
  type: NotificationType;
  taskId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
  message: string;
  read: boolean;
  projectId?: string;
  workspaceId?: string;
  schemeId?: string;
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
      enum: [
        "assigned",
        "mentioned",
        "status_changed",
        "commented",
        "issue_created",
        "issue_updated",
        "issue_deleted",
        "sprint_started",
        "sprint_completed",
      ],
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
    projectId: {
      type: String,
      default: null,
    },
    workspaceId: {
      type: String,
      default: null,
    },
    schemeId: {
      type: String,
      default: null,
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
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ projectId: 1 });

const Notification = mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
