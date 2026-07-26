import Workflow from "../models/mongoose/Workflow";
import WorkflowScheme from "../models/mongoose/WorkflowScheme";
import Task from "../models/mongoose/Task";
import { AppError } from "../utils/AppError";
import type { StatusCategory, ITransitionCondition, ITransitionValidator, ITransitionPostFunction } from "../models/mongoose/Workflow";

interface CreateWorkflowInput {
  name: string;
  projectId: string;
  workspaceId: string;
  statuses: {
    name: string;
    color: string;
    position: number;
    description?: string;
    category?: StatusCategory;
  }[];
  transitions?: {
    from: string;
    to: string;
    name: string;
    conditions?: ITransitionCondition[];
    validators?: ITransitionValidator[];
    postFunctions?: ITransitionPostFunction[];
  }[];
  defaultStatus: string;
  isDefault?: boolean;
  createdBy: string;
}

export async function createWorkflow(input: CreateWorkflowInput) {
  const existing = await Workflow.findOne({ projectId: input.projectId, name: input.name });
  if (existing) throw new AppError("Workflow with this name already exists for this project", 409);

  const workflow = await Workflow.create({
    ...input,
    statuses: input.statuses.map((s) => ({ ...s, category: s.category || "todo" })),
    transitions: input.transitions || [],
  });
  return workflow;
}

export async function getWorkflowById(id: string) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);
  return workflow;
}

export async function getProjectWorkflows(projectId: string) {
  return Workflow.find({ projectId }).sort({ createdAt: -1 });
}

export async function getWorkspaceWorkflows(workspaceId: string) {
  return Workflow.find({ workspaceId }).sort({ createdAt: -1 });
}

export async function getDefaultWorkflow(projectId: string) {
  const workflow = await Workflow.findOne({ projectId, isDefault: true });
  if (workflow) return workflow;
  const first = await Workflow.findOne({ projectId }).sort({ createdAt: 1 });
  return first;
}

export async function updateWorkflow(id: string, input: {
  name?: string;
  statuses?: {
    name: string;
    color: string;
    position: number;
    description?: string;
    category?: StatusCategory;
  }[];
  transitions?: {
    from: string;
    to: string;
    name: string;
    conditions?: ITransitionCondition[];
    validators?: ITransitionValidator[];
    postFunctions?: ITransitionPostFunction[];
  }[];
  defaultStatus?: string;
  isDefault?: boolean;
}) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.statuses !== undefined) updateData.statuses = input.statuses.map((s) => ({ ...s, category: s.category || "todo" }));
  if (input.transitions !== undefined) updateData.transitions = input.transitions;
  if (input.defaultStatus !== undefined) updateData.defaultStatus = input.defaultStatus;
  if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

  const updated = await Workflow.findByIdAndUpdate(id, updateData, { new: true });
  if (!updated) throw new AppError("Failed to update workflow", 500);
  return updated;
}

export async function deleteWorkflow(id: string) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);
  if (workflow.isDefault) throw new AppError("Cannot delete default workflow", 400);

  const scheme = await WorkflowScheme.findOne({
    $or: [
      { defaultWorkflowId: id },
      { "mappings.workflowId": id },
    ],
  });
  if (scheme) throw new AppError("Cannot delete workflow that is in use by a workflow scheme", 400);

  await Workflow.deleteOne({ _id: id });
}

export async function seedDefaultWorkflow(projectId: string, workspaceId: string, createdBy: string) {
  const existing = await Workflow.findOne({ projectId, isDefault: true });
  if (existing) return existing;

  return Workflow.create({
    name: "Default Workflow",
    projectId,
    workspaceId,
    statuses: [
      { name: "Todo", color: "#6B7280", position: 0, category: "todo" as StatusCategory },
      { name: "In Progress", color: "#2563EB", position: 1, category: "in_progress" as StatusCategory },
      { name: "In Review", color: "#F59E0B", position: 2, category: "in_progress" as StatusCategory },
      { name: "Done", color: "#10B981", position: 3, category: "done" as StatusCategory },
    ],
    transitions: [
      { from: "Todo", to: "In Progress", name: "Start", conditions: [], validators: [], postFunctions: [] },
      { from: "In Progress", to: "In Review", name: "Request Review", conditions: [], validators: [], postFunctions: [] },
      { from: "In Progress", to: "Todo", name: "Move Back", conditions: [], validators: [], postFunctions: [] },
      { from: "In Review", to: "Done", name: "Complete", conditions: [], validators: [], postFunctions: [] },
      { from: "In Review", to: "In Progress", name: "Rework", conditions: [], validators: [], postFunctions: [] },
      { from: "Done", to: "In Progress", name: "Reopen", conditions: [], validators: [], postFunctions: [] },
    ],
    defaultStatus: "Todo",
    isDefault: true,
    createdBy,
  });
}

export async function copyWorkflow(id: string, newName: string) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);

  const existing = await Workflow.findOne({ projectId: workflow.projectId, name: newName });
  if (existing) throw new AppError("Workflow with this name already exists", 409);

  return Workflow.create({
    name: newName,
    projectId: workflow.projectId,
    workspaceId: workflow.workspaceId,
    statuses: workflow.statuses.map((s) => ({ ...s })),
    transitions: workflow.transitions.map((t) => ({ ...t })),
    defaultStatus: workflow.defaultStatus,
    isDefault: false,
    createdBy: workflow.createdBy,
  });
}

export async function getWorkflowUsage(id: string) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);

  const schemes = await WorkflowScheme.find({
    $or: [
      { defaultWorkflowId: id },
      { "mappings.workflowId": id },
    ],
  });

  const issueTypes = new Set<string>();
  for (const scheme of schemes) {
    if (scheme.defaultWorkflowId === id) {
      issueTypes.add("default");
    }
    for (const m of scheme.mappings) {
      if (m.workflowId === id) {
        issueTypes.add(m.issueType);
      }
    }
  }

  return {
    usedBySchemes: schemes.length,
    schemes: schemes.map((s) => ({ id: s._id, name: s.name })),
    issueTypes: Array.from(issueTypes),
  };
}

export async function validateTransition(
  workflowId: string,
  transitionName: string,
  taskKey: string,
  userId: string,
  userRoles: string[]
) {
  const workflow = await Workflow.findById(workflowId);
  if (!workflow) throw new AppError("Workflow not found", 404);

  const transition = workflow.transitions.find((t) => t.name === transitionName);
  if (!transition) throw new AppError("Transition not found", 404);

  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const errors: string[] = [];

  for (const condition of transition.conditions) {
    switch (condition.type) {
      case "assignee":
        if (task.assignee?.toString() !== userId) {
          errors.push("Only the assignee can perform this transition");
        }
        break;
      case "reporter":
        if (task.reporter?.toString() !== userId) {
          errors.push("Only the reporter can perform this transition");
        }
        break;
      case "role":
        if (condition.role && !userRoles.includes(condition.role)) {
          errors.push(`Requires role: ${condition.role}`);
        }
        break;
      case "project_admin":
        if (!userRoles.includes("admin")) {
          errors.push("Only project admins can perform this transition");
        }
        break;
    }
  }

  for (const validator of transition.validators) {
    const taskObj = task.toObject();
    const fieldValue = (taskObj as any)[validator.field];

    switch (validator.operator) {
      case "not_empty":
        if (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim())) {
          errors.push(`Field "${validator.field}" must not be empty`);
        }
        break;
      case "equals":
        if (fieldValue?.toString() !== validator.value) {
          errors.push(`Field "${validator.field}" must equal "${validator.value}"`);
        }
        break;
      case "not_equals":
        if (fieldValue?.toString() === validator.value) {
          errors.push(`Field "${validator.field}" must not be "${validator.value}"`);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function executePostFunctions(workflowId: string, transitionName: string, taskKey: string) {
  const workflow = await Workflow.findById(workflowId);
  if (!workflow) throw new AppError("Workflow not found", 404);

  const transition = workflow.transitions.find((t) => t.name === transitionName);
  if (!transition) throw new AppError("Transition not found", 404);

  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  for (const pf of transition.postFunctions) {
    switch (pf.type) {
      case "update_field":
        if (pf.field && pf.value !== undefined) {
          (task as any)[pf.field] = pf.value;
        }
        break;
      case "add_comment":
        break;
      case "send_notification":
        break;
    }
  }

  await task.save();
  return task;
}
