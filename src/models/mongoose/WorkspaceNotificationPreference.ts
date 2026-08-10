import mongoose, { Schema } from "mongoose";

export interface IWorkspaceNotificationPreference {
  workspaceId: string;
  userId: string;
  events: string[];
  createdAt: Date;
  updatedAt: Date;
}

const workspaceNotificationPreferenceSchema = new Schema<IWorkspaceNotificationPreference>(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    events: { type: [String], default: [] },
  },
  { timestamps: true }
);

workspaceNotificationPreferenceSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

const WorkspaceNotificationPreference = mongoose.model<IWorkspaceNotificationPreference>(
  "WorkspaceNotificationPreference",
  workspaceNotificationPreferenceSchema
);

export default WorkspaceNotificationPreference;