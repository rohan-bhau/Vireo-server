import AutomationRule from "../models/mongoose/AutomationRule";
import Task from "../models/mongoose/Task";
import ActivityLog from "../models/mongoose/ActivityLog";
import { AppError } from "../utils/AppError";

interface CreateRuleInput {
  name: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  trigger: string;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string; config: Record<string, string> }[];
  createdBy: string;
}

export async function createRule(input: CreateRuleInput) {
  const rule = await AutomationRule.create({ ...input, enabled: true, triggerCount: 0 } as any);
  return rule;
}

export async function getRuleById(id: string) {
  const rule = await AutomationRule.findById(id);
  if (!rule) throw new AppError("Automation rule not found", 404);
  return rule;
}

export async function getWorkspaceRules(workspaceId: string) {
  return AutomationRule.find({ workspaceId }).sort({ createdAt: -1 });
}

export async function getProjectRules(projectId: string) {
  return AutomationRule.find({ projectId }).sort({ createdAt: -1 });
}

export async function updateRule(id: string, input: Partial<CreateRuleInput>) {
  const rule = await AutomationRule.findById(id);
  if (!rule) throw new AppError("Automation rule not found", 404);

  if (input.name !== undefined) rule.name = input.name;
  if (input.description !== undefined) rule.description = input.description;
  if (input.trigger !== undefined) rule.trigger = input.trigger as any;
  if (input.conditions !== undefined) rule.conditions = input.conditions as any;
  if (input.actions !== undefined) rule.actions = input.actions as any;

  const updated = await rule.save();
  return updated;
}

export async function toggleRule(id: string) {
  const rule = await AutomationRule.findById(id);
  if (!rule) throw new AppError("Automation rule not found", 404);
  rule.enabled = !rule.enabled;
  const updated = await rule.save();
  return updated;
}

export async function deleteRule(id: string) {
  const rule = await AutomationRule.findById(id);
  if (!rule) throw new AppError("Automation rule not found", 404);
  await AutomationRule.deleteOne({ _id: id });
}

export async function evaluateTriggers(
  trigger: string,
  context: { taskKey?: string; task?: any; workspaceId: string; projectId?: string; actorId: string }
) {
  const query: any = { trigger, enabled: true, workspaceId: context.workspaceId };
  if (context.projectId) {
    query.$or = [{ projectId: context.projectId }, { projectId: { $exists: false } }];
  }

  const rules = await AutomationRule.find(query);

  for (const rule of rules) {
    try {
      const conditionsMet = evaluateConditions(rule.conditions, context.task || {});
      if (!conditionsMet) continue;

      await executeActions(rule.actions, context);
      rule.lastTriggeredAt = new Date();
      rule.triggerCount += 1;
      await rule.save();

      await ActivityLog.create({
        taskId: context.taskKey || "system",
        actorId: context.actorId,
        action: "updated",
        field: "automation",
        newValue: `Rule "${rule.name}" triggered`,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error(`Automation rule "${rule.name}" failed:`, err);
    }
  }
}

function evaluateConditions(conditions: any[], task: any): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition) => {
    const fieldValue = getNestedValue(task, condition.field);
    switch (condition.operator) {
      case "equals": return String(fieldValue) === condition.value;
      case "not_equals": return String(fieldValue) !== condition.value;
      case "contains": return String(fieldValue).includes(condition.value);
      case "not_contains": return !String(fieldValue).includes(condition.value);
      case "greater_than": return Number(fieldValue) > Number(condition.value);
      case "less_than": return Number(fieldValue) < Number(condition.value);
      case "is_empty": return !fieldValue || fieldValue === "";
      case "is_not_empty": return fieldValue && fieldValue !== "";
      case "changed_to": return String(fieldValue) === condition.value;
      case "changed_from": return String(fieldValue) !== condition.value;
      default: return true;
    }
  });
}

async function executeActions(actions: any[], context: { taskKey?: string; workspaceId: string; actorId: string }) {
  if (!context.taskKey) return;

  const task = await Task.findOne({ taskKey: context.taskKey });
  if (!task) return;

  for (const action of actions) {
    switch (action.type) {
      case "assign_to":
        task.assignee = action.config.userId;
        break;
      case "set_status":
        task.status = action.config.status;
        break;
      case "set_priority":
        task.priority = action.config.priority;
        break;
      case "add_label":
        if (!task.labels.includes(action.config.label)) {
          task.labels.push(action.config.label);
        }
        break;
      case "remove_label":
        task.labels = task.labels.filter((l) => l !== action.config.label);
        break;
      case "set_due_date":
        task.dueDate = new Date(action.config.dueDate);
        break;
      case "move_to_sprint":
        task.sprintId = action.config.sprintId;
        break;
      case "notify":
        break;
      case "add_subtask":
        break;
      case "webhook":
        break;
    }
  }

  await task.save();
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}
