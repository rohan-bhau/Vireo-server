import mongoose, { Schema } from "mongoose";

export type EpicStatus = "open" | "in_progress" | "done" | "cancelled";
export type EpicPriority = "lowest" | "low" | "medium" | "high" | "highest";

export interface IEpic {
  epicKey: string;
  name: string;
  description?: string;
  projectId: string;
  color: string;
  status: EpicStatus;
  priority: EpicPriority;
  workspaceId: string;
}

const epicSchema = new Schema<IEpic>(
  {
    epicKey: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [200, "Name must be at most 200 characters"],
    },
    description: {
      type: String,
      default: "",
    },
    projectId: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: "#6366f1",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "done", "cancelled"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["lowest", "low", "medium", "high", "highest"],
      default: "medium",
    },
    workspaceId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

epicSchema.index({ epicKey: 1 });
epicSchema.index({ projectId: 1 });
epicSchema.index({ workspaceId: 1 });

const Epic = mongoose.model<IEpic>("Epic", epicSchema);

export default Epic;
