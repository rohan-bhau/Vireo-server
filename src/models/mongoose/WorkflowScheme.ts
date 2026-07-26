import mongoose, { Document, Schema } from "mongoose";

export interface IWorkflowSchemeMapping {
  issueType: string;
  workflowId: string;
}

export interface IWorkflowScheme {
  projectId: string;
  workspaceId: string;
  name: string;
  description?: string;
  mappings: IWorkflowSchemeMapping[];
  defaultWorkflowId: string;
  createdBy: string;
}

const workflowSchemeMappingSchema = new Schema<IWorkflowSchemeMapping>(
  {
    issueType: { type: String, required: true },
    workflowId: { type: String, required: true },
  },
  { _id: false }
);

const workflowSchemeSchema = new Schema<IWorkflowScheme>(
  {
    name: { type: String, required: true },
    projectId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    description: String,
    mappings: { type: [workflowSchemeMappingSchema], default: [] },
    defaultWorkflowId: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

workflowSchemeSchema.index({ projectId: 1 });
workflowSchemeSchema.index({ workspaceId: 1 });

const WorkflowScheme = mongoose.model<IWorkflowScheme>("WorkflowScheme", workflowSchemeSchema);

export default WorkflowScheme;
