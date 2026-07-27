import mongoose, { Document, Schema } from "mongoose";

export type AutomationTrigger =
  | "task.created"
  | "task.updated"
  | "task.status_changed"
  | "task.assigned"
  | "comment.added"
  | "scheduled"
  | "sprint.started"
  | "sprint.completed";

export type AutomationActionType =
  | "assign_to"
  | "set_status"
  | "set_priority"
  | "add_label"
  | "remove_label"
  | "set_due_date"
  | "move_to_sprint"
  | "notify"
  | "add_subtask"
  | "webhook"
  | "add_comment"
  | "create_issue"
  | "link_issues";

export interface IAutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty" | "changed_to" | "changed_from";
  value: string;
}

export interface IAutomationAction {
  type: AutomationActionType;
  config: Record<string, string>;
}

export interface IAutomationBranch {
  type: "subtask" | "linked_issue" | "jql";
  config: Record<string, string>;
  actions: IAutomationAction[];
}

export interface IAutomationRule {
  name: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  trigger: AutomationTrigger;
  cronExpression?: string;
  conditions: IAutomationCondition[];
  branches: IAutomationBranch[];
  actions: IAutomationAction[];
  enabled: boolean;
  createdBy: string;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

const automationConditionSchema = new Schema<IAutomationCondition>(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "is_empty", "is_not_empty", "changed_to", "changed_from"],
      required: true,
    },
    value: { type: String, required: true },
  },
  { _id: false }
);

const automationActionSchema = new Schema<IAutomationAction>(
  {
    type: {
      type: String,
      enum: ["assign_to", "set_status", "set_priority", "add_label", "remove_label", "set_due_date", "move_to_sprint", "notify", "add_subtask", "webhook", "add_comment", "create_issue", "link_issues"],
      required: true,
    },
    config: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const automationBranchSchema = new Schema<IAutomationBranch>(
  {
    type: {
      type: String,
      enum: ["subtask", "linked_issue", "jql"],
      required: true,
    },
    config: { type: Schema.Types.Mixed, required: true },
    actions: { type: [automationActionSchema], default: [] },
  },
  { _id: false }
);

const automationRuleSchema = new Schema<IAutomationRule>(
  {
    name: { type: String, required: true },
    description: String,
    workspaceId: { type: String, required: true },
    projectId: String,
    trigger: {
      type: String,
      enum: ["task.created", "task.updated", "task.status_changed", "task.assigned", "comment.added", "scheduled", "sprint.started", "sprint.completed"],
      required: true,
    },
    cronExpression: String,
    conditions: { type: [automationConditionSchema], default: [] },
    branches: { type: [automationBranchSchema], default: [] },
    actions: { type: [automationActionSchema], required: true },
    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    lastTriggeredAt: Date,
    triggerCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

automationRuleSchema.index({ workspaceId: 1, enabled: 1 });
automationRuleSchema.index({ projectId: 1 });

const AutomationRule = mongoose.model<IAutomationRule>("AutomationRule", automationRuleSchema);

export default AutomationRule;
