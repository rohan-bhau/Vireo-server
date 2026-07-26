import mongoose, { Schema } from "mongoose";

export type WorkflowStatus = "todo" | "in_progress" | "in_review" | "done" | string;
export type StatusCategory = "todo" | "in_progress" | "done";

export interface IWorkflowStatus {
  name: string;
  color: string;
  position: number;
  description?: string;
  category: StatusCategory;
}

export interface ITransitionCondition {
  type: "role" | "assignee" | "reporter" | "project_admin";
  role?: string;
}

export interface ITransitionValidator {
  field: string;
  operator: "not_empty" | "equals" | "not_equals";
  value?: string;
}

export interface ITransitionPostFunction {
  type: "update_field" | "add_comment" | "send_notification";
  field?: string;
  value?: string;
  comment?: string;
}

export interface IWorkflowTransition {
  from: string;
  to: string;
  name: string;
  conditions: ITransitionCondition[];
  validators: ITransitionValidator[];
  postFunctions: ITransitionPostFunction[];
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

const transitionConditionSchema = new Schema<ITransitionCondition>(
  {
    type: { type: String, required: true, enum: ["role", "assignee", "reporter", "project_admin"] },
    role: String,
  },
  { _id: false }
);

const transitionValidatorSchema = new Schema<ITransitionValidator>(
  {
    field: { type: String, required: true },
    operator: { type: String, required: true, enum: ["not_empty", "equals", "not_equals"] },
    value: String,
  },
  { _id: false }
);

const transitionPostFunctionSchema = new Schema<ITransitionPostFunction>(
  {
    type: { type: String, required: true, enum: ["update_field", "add_comment", "send_notification"] },
    field: String,
    value: String,
    comment: String,
  },
  { _id: false }
);

const workflowStatusSchema = new Schema<IWorkflowStatus>(
  {
    name: { type: String, required: true },
    color: { type: String, required: true, default: "#6B7280" },
    position: { type: Number, required: true },
    description: String,
    category: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
  },
  { _id: false }
);

const workflowTransitionSchema = new Schema<IWorkflowTransition>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    name: { type: String, required: true },
    conditions: { type: [transitionConditionSchema], default: [] },
    validators: { type: [transitionValidatorSchema], default: [] },
    postFunctions: { type: [transitionPostFunctionSchema], default: [] },
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
