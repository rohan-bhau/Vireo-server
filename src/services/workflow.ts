import Workflow from "../models/mongoose/Workflow";
import { AppError } from "../utils/AppError";

interface CreateWorkflowInput {
  name: string;
  projectId: string;
  workspaceId: string;
  statuses: { name: string; color: string; position: number; description?: string }[];
  transitions?: { from: string; to: string; name: string; requiredRole?: string[]; conditions?: any[] }[];
  defaultStatus: string;
  isDefault?: boolean;
  createdBy: string;
}

export async function createWorkflow(input: CreateWorkflowInput) {
  const existing = await Workflow.findOne({ projectId: input.projectId, name: input.name });
  if (existing) throw new AppError("Workflow with this name already exists for this project", 409);

  const workflow = await Workflow.create(input);
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

interface UpdateWorkflowInput {
  name?: string;
  statuses?: { name: string; color: string; position: number; description?: string }[];
  transitions?: { from: string; to: string; name: string; requiredRole?: string[]; conditions?: any[] }[];
  defaultStatus?: string;
  isDefault?: boolean;
}

export async function updateWorkflow(id: string, input: UpdateWorkflowInput) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);

  if (input.name !== undefined) workflow.name = input.name;
  if (input.statuses !== undefined) workflow.statuses = input.statuses;
  if (input.transitions !== undefined) workflow.transitions = input.transitions;
  if (input.defaultStatus !== undefined) workflow.defaultStatus = input.defaultStatus;
  if (input.isDefault !== undefined) workflow.isDefault = input.isDefault;

  const updated = await workflow.save();
  return updated;
}

export async function deleteWorkflow(id: string) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw new AppError("Workflow not found", 404);
  if (workflow.isDefault) throw new AppError("Cannot delete default workflow", 400);
  await Workflow.deleteOne({ _id: id });
}

export async function seedDefaultWorkflow(projectId: string, workspaceId: string, createdBy: string) {
  const existing = await Workflow.findOne({ projectId, isDefault: true });
  if (existing) return existing;

  const defaultStatuses = [
    { name: "Todo", color: "#6B7280", position: 0 },
    { name: "In Progress", color: "#2563EB", position: 1 },
    { name: "In Review", color: "#F59E0B", position: 2 },
    { name: "Done", color: "#10B981", position: 3 },
  ];

  const defaultTransitions = [
    { from: "Todo", to: "In Progress", name: "Start" },
    { from: "In Progress", to: "In Review", name: "Request Review" },
    { from: "In Progress", to: "Todo", name: "Move Back" },
    { from: "In Review", to: "Done", name: "Complete" },
    { from: "In Review", to: "In Progress", name: "Rework" },
    { from: "Done", to: "In Progress", name: "Reopen" },
  ];

  return Workflow.create({
    name: "Default Workflow",
    projectId,
    workspaceId,
    statuses: defaultStatuses,
    transitions: defaultTransitions,
    defaultStatus: "Todo",
    isDefault: true,
    createdBy,
  });
}
