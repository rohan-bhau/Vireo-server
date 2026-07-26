import mongoose, { Document, Schema } from "mongoose";

export interface IFilterCondition {
  field: string;
  operator: string;
  value: string;
}

export interface ISavedFilter {
  name: string;
  userId: string;
  workspaceId: string;
  projectId?: string;
  jql?: string;
  conditions: IFilterCondition[];
  sortField?: string;
  sortOrder?: "asc" | "desc";
  columns?: string[];
  isShared: boolean;
}

const filterConditionSchema = new Schema<IFilterCondition>(
  {
    field: { type: String, required: true },
    operator: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const savedFilterSchema = new Schema<ISavedFilter>(
  {
    name: { type: String, required: true },
    userId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    projectId: String,
    jql: String,
    conditions: { type: [filterConditionSchema], default: [] },
    sortField: String,
    sortOrder: { type: String, enum: ["asc", "desc"], default: "asc" },
    columns: { type: [String], default: ["taskKey", "title", "status", "priority", "assignee", "updatedAt"] },
    isShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

savedFilterSchema.index({ userId: 1, workspaceId: 1 });
savedFilterSchema.index({ workspaceId: 1, isShared: 1 });

const SavedFilter = mongoose.model<ISavedFilter>("SavedFilter", savedFilterSchema);

export default SavedFilter;
