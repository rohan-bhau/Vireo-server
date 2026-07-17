import mongoose, { Document, Schema } from "mongoose";

export interface IActivityLog extends Document {
  taskId: string;
  actorId: string;
  action: "created" | "updated" | "status_changed" | "assigned" | "commented" | "attachment_added" | "attachment_removed";
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    actorId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ["created", "updated", "status_changed", "assigned", "commented", "attachment_added", "attachment_removed"],
      required: true,
    },
    field: {
      type: String,
      default: null,
    },
    oldValue: {
      type: String,
      default: null,
    },
    newValue: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

activityLogSchema.index({ taskId: 1, timestamp: -1 });

const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);

export default ActivityLog;
