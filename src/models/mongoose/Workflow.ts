import mongoose, { Document, Schema } from "mongoose";

export type WorkflowStatus = "todo" | "in_progress" | "in_review" | "done" | string;

export interface IWorkflowStatus {
  name: string;
  color: string;
  position: number;
  description?: string;
}

export interface IWorkflowTransition {
  from: string;
  to: string;
  name: string;
  requiredRole?: string[];
  conditions?: { field: string; operator: string; value: string }[];
}

export interface IWorkflow {
  name: string;
  projectId: string;
  workspaceId: string;
  statuses: IWorkflowStatus[];
  transitions: IWorkflowTransition[];
  defaultStatus: string;
  isDefault: boolean;
  createdBy: string;
}

const workflowStatusSchema = new Schema<IWorkflowStatus>(
  {
    name: { type: String, required: true },
    color: { type: String, required: true, default: "#6B7280" },
    position: { type: Number, required: true },
    description: String,
  },
  { _id: false }
);

const workflowTransitionSchema = new Schema<IWorkflowTransition>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    name: { type: String, required: true },
    requiredRole: [String],
    conditions: [
      {
        field: String,
        operator: String,
        value: String,
      },
    ],
  },
  { _id: false }
);

const workflowSchema = new Schema<IWorkflow>(
  {
    name: { type: String, required: true },
    projectId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    statuses: { type: [workflowStatusSchema], required: true },
    transitions: { type: [workflowTransitionSchema], default: [] },
    defaultStatus: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

workflowSchema.index({ projectId: 1 });
workflowSchema.index({ workspaceId: 1 });

const Workflow = mongoose.model<IWorkflow>("Workflow", workflowSchema);

export default Workflow;
