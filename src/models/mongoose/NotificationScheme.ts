import mongoose, { Schema } from "mongoose";

export type NotificationEvent =
  | "issue_created"
  | "issue_updated"
  | "issue_assigned"
  | "issue_commented"
  | "issue_transitioned"
  | "issue_deleted"
  | "sprint_started"
  | "sprint_completed"
  | "mentioned";

export type RecipientType =
  | "reporter"
  | "assignee"
  | "watchers"
  | "project_lead"
  | "all_project_members"
  | "custom_role";

export interface INotificationSchemeEvent {
  event: NotificationEvent;
  recipients: RecipientType[];
  email: boolean;
  inApp: boolean;
}

export interface INotificationScheme {
  name: string;
  workspaceId: string;
  description?: string;
  default: boolean;
  events: INotificationSchemeEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchemeEventSchema = new Schema<INotificationSchemeEvent>(
  {
    event: {
      type: String,
      enum: [
        "issue_created",
        "issue_updated",
        "issue_assigned",
        "issue_commented",
        "issue_transitioned",
        "issue_deleted",
        "sprint_started",
        "sprint_completed",
        "mentioned",
      ],
      required: true,
    },
    recipients: {
      type: [String],
      enum: [
        "reporter",
        "assignee",
        "watchers",
        "project_lead",
        "all_project_members",
        "custom_role",
      ],
      default: ["assignee", "reporter", "watchers"],
    },
    email: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
  },
  { _id: false }
);

const notificationSchemeSchema = new Schema<INotificationScheme>(
  {
    name: {
      type: String,
      required: [true, "Scheme name is required"],
      trim: true,
    },
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    default: {
      type: Boolean,
      default: false,
    },
    events: {
      type: [notificationSchemeEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

notificationSchemeSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

const NotificationScheme = mongoose.model<INotificationScheme>(
  "NotificationScheme",
  notificationSchemeSchema
);

export default NotificationScheme;
