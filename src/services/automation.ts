import AutomationRule from "../models/mongoose/AutomationRule";
import Task from "../models/mongoose/Task";
import ActivityLog from "../models/mongoose/ActivityLog";
import { AppError } from "../utils/AppError";
import { checkAutomationRunLimit, recordAutomationRun } from "./billing";

interface CreateRuleInput {
  name: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  trigger: string;
  cronExpression?: string;
  conditions: { field: string; operator: string; value: string }[];
  branches?: { type: string; config: Record<string, string>; actions: { type: string; config: Record<string, string> }[] }[];
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
  if (input.cronExpression !== undefined) rule.cronExpression = input.cronExpression;
  if (input.conditions !== undefined) rule.conditions = input.conditions as any;
  if (input.branches !== undefined) rule.branches = input.branches as any;
  if (input.actions !== undefined) rule.actions = input.actions as any;

  const updated = await rule.save();
  return updated;
}

export async function copyRule(id: string, newCreatedBy: string) {
  const original = await AutomationRule.findById(id);
  if (!original) throw new AppError("Automation rule not found", 404);

  const copy = await AutomationRule.create({
    name: `${original.name} (copy)`,
    description: original.description,
    workspaceId: original.workspaceId,
    projectId: original.projectId,
    trigger: original.trigger,
    cronExpression: original.cronExpression,
    conditions: original.conditions,
    branches: original.branches,
    actions: original.actions,
    enabled: false,
    createdBy: newCreatedBy,
    triggerCount: 0,
  } as any);

  return copy;
}

export async function getRuleAudit(ruleName: string) {
  const entries = await ActivityLog.find({
    field: "automation",
    newValue: { $regex: ruleName ? `"${escapeRegex(ruleName)}"` : "", $options: "i" },
  })
    .sort({ timestamp: -1 })
    .limit(50);

  return entries.map((e) => ({
    _id: e._id,
    ruleName: e.newValue?.replace(/^Rule "/, "").replace(/" triggered$/, "") || "",
    taskKey: e.taskId,
    action: e.action,
    status: "success" as const,
    timestamp: e.timestamp,
  }));
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseNaturalLanguage(description: string) {
  const lower = description.toLowerCase();

  let trigger: string = "task.created";
  let conditions: { field: string; operator: string; value: string }[] = [];
  let actions: { type: string; config: Record<string, string> }[] = [];

  if (lower.includes("bug") || lower.includes("bug created")) {
    trigger = "task.created";
    conditions = [{ field: "type", operator: "equals", value: "bug" }];
  } else if (lower.includes("high priority") || lower.includes("highest priority")) {
    trigger = "task.created";
    conditions = [{ field: "priority", operator: "equals", value: "Highest" }];
  } else if (lower.includes("comment added") || lower.includes("someone comments")) {
    trigger = "comment.added";
  } else if (lower.includes("status change") || lower.includes("transition") || lower.includes("moved to")) {
    trigger = "task.status_changed";
  } else if (lower.includes("assign") || lower.includes("assigned")) {
    trigger = "task.assigned";
  } else if (lower.includes("every day") || lower.includes("every week") || lower.includes("every month") || lower.includes("cron") || lower.includes("schedule")) {
    trigger = "scheduled";
  } else if (lower.includes("update") || lower.includes("updated") || lower.includes("changed")) {
    trigger = "task.updated";
  }

  if (lower.includes("due date") || lower.includes("due")) {
    actions.push({ type: "set_due_date", config: { dueDate: "7" } });
  }
  if (lower.includes("assign") || lower.includes("assign to")) {
    actions.push({ type: "assign_to", config: { userId: "{reporter}" } });
  }
  if (lower.includes("notify") || lower.includes("email") || lower.includes("send")) {
    actions.push({ type: "notify", config: { recipients: "{reporter}", template: "notification" } });
  }
  if (lower.includes("status") || lower.includes("transition") || lower.includes("move to")) {
    const statusMatch = description.match(/move to (\w+)/i) || description.match(/transition to (\w+)/i);
    const status = statusMatch ? statusMatch[1] : "In Progress";
    actions.push({ type: "set_status", config: { status } });
  }
  if (lower.includes("comment") || lower.includes("add comment")) {
    actions.push({ type: "add_comment", config: { text: description.match(/comment:?\s*(.+)/i)?.[1] || "Auto-generated comment" } });
  }
  if (lower.includes("label") || lower.includes("add label")) {
    const labelMatch = description.match(/label:?\s*(\w+)/i);
    actions.push({ type: "add_label", config: { label: labelMatch?.[1] || "auto" } });
  }
  if (lower.includes("create") || lower.includes("create issue") || lower.includes("new issue")) {
    actions.push({ type: "create_issue", config: { type: "task", summary: "Auto-created from automation rule" } });
  }
  if (lower.includes("link") || lower.includes("relate") || lower.includes("block")) {
    actions.push({ type: "link_issues", config: { relation: lower.includes("block") ? "blocks" : "relates to", targetIssueKey: "{key}" } });
  }

  if (actions.length === 0) {
    actions.push({ type: "set_status", config: { status: "In Progress" } });
  }

  return { trigger, conditions, actions };
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

      // Plan gate: skip the run when the workspace's monthly automation
      // budget is exhausted. Fire-and-forget callers — never throw here.
      const runLimit = await checkAutomationRunLimit(context.workspaceId);
      if (!runLimit.allowed) {
        console.warn(
          `[Automation] Skipping rule "${rule.name}" — ${runLimit.plan} plan automation limit reached (${runLimit.used}/${runLimit.limit ?? "∞"}) for workspace ${context.workspaceId}`
        );
        continue;
      }

      if (rule.branches && rule.branches.length > 0) {
        await executeBranches(rule.branches, context);
      } else {
        await executeActions(rule.actions, context);
      }

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

      await recordAutomationRun(context.workspaceId);
    } catch (err) {
      console.error(`Automation rule "${rule.name}" failed:`, err);
    }
  }
}

export async function getScheduledRules() {
  return AutomationRule.find({ trigger: "scheduled", enabled: true });
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

async function executeBranches(branches: any[], context: { taskKey?: string; workspaceId: string; actorId: string; projectId?: string }) {
  for (const branch of branches) {
    let targetTasks: any[] = [];

    switch (branch.type) {
      case "subtask": {
        const parentTask = await Task.findOne({ taskKey: context.taskKey }) as any;
        if (parentTask?.subtasks?.length > 0) {
          for (const sub of parentTask.subtasks) {
            const subTask = await Task.findById(typeof sub === "string" ? sub : sub._id || sub.toString());
            if (subTask) targetTasks.push(subTask);
          }
        }
        break;
      }
      case "linked_issue": {
        const task = await Task.findOne({ taskKey: context.taskKey }) as any;
        if (task?.linkedIssues?.length > 0) {
          for (const link of task.linkedIssues) {
            const linked = await Task.findOne({ taskKey: link.targetKey || link.taskKey });
            if (linked) targetTasks.push(linked);
          }
        }
        break;
      }
      case "jql": {
        const jql = branch.config?.jql;
        if (jql && context.projectId) {
          targetTasks = await Task.find({ projectId: context.projectId }).limit(50);
        }
        break;
      }
    }

    for (const targetTask of targetTasks) {
      await executeActions(branch.actions, { ...context, taskKey: targetTask.taskKey });
    }
  }
}

async function executeActions(actions: any[], context: { taskKey?: string; workspaceId: string; actorId: string }) {
  if (!context.taskKey) return;

  const t = await Task.findOne({ taskKey: context.taskKey }) as any;
  if (!t) return;

  for (const action of actions) {
    switch (action.type) {
      case "assign_to":
        t.assignee = action.config.userId;
        break;
      case "set_status":
        t.status = action.config.status;
        break;
      case "set_priority":
        t.priority = action.config.priority;
        break;
      case "add_label":
        if (!t.labels?.includes(action.config.label)) {
          if (!t.labels) t.labels = [];
          t.labels.push(action.config.label);
        }
        break;
      case "remove_label":
        if (t.labels) {
          t.labels = t.labels.filter((l: string) => l !== action.config.label);
        }
        break;
      case "set_due_date":
        if (action.config.dueDate) {
          const days = parseInt(action.config.dueDate, 10);
          if (!isNaN(days)) {
            const d = new Date();
            d.setDate(d.getDate() + days);
            t.dueDate = d;
          } else {
            t.dueDate = new Date(action.config.dueDate);
          }
        }
        break;
      case "move_to_sprint":
        t.sprintId = action.config.sprintId;
        break;
      case "add_comment": {
        const commentText = action.config.text || "Auto-generated comment";
        if (!t.comments) t.comments = [];
        t.comments.push({
          text: commentText,
          author: context.actorId,
          createdAt: new Date(),
        });
        break;
      }
      case "create_issue": {
        const newTaskKey = `AUTO-${Date.now()}`;
        await Task.create({
          taskKey: newTaskKey,
          title: action.config.summary || "Auto-created issue",
          type: action.config.type || "task",
          status: "To Do",
          projectId: t.projectId,
          workspaceId: context.workspaceId,
          reporter: context.actorId,
          description: "Auto-created by automation rule",
        } as any);
        break;
      }
      case "link_issues": {
        const targetKey = action.config.targetIssueKey;
        if (targetKey && targetKey !== context.taskKey) {
          if (!t.linkedIssues) t.linkedIssues = [];
          t.linkedIssues.push({
            targetKey,
            relation: action.config.relation || "relates to",
          });
        }
        break;
      }
      case "notify":
        break;
      case "add_subtask": {
        const subtaskKey = `SUB-${Date.now()}`;
        await Task.create({
          taskKey: subtaskKey,
          title: action.config.summary || "Auto-created subtask",
          type: "subtask",
          status: "To Do",
          projectId: t.projectId,
          workspaceId: context.workspaceId,
          reporter: context.actorId,
          parentKey: context.taskKey,
        } as any);
        break;
      }
      case "webhook": {
        const url = action.config.url;
        if (url) {
          try {
            await fetch(url, {
              method: (action.config.method as "POST" | "PUT") || "POST",
              headers: { "Content-Type": "application/json" },
              body: action.config.body || JSON.stringify({ taskKey: context.taskKey }),
            });
          } catch {
            console.warn(`Webhook call to ${url} failed`);
          }
        }
        break;
      }
    }
  }

  await t.save();
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}
