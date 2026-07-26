import WorkflowScheme from "../models/mongoose/WorkflowScheme";
import Workflow from "../models/mongoose/Workflow";
import { AppError } from "../utils/AppError";

interface CreateSchemeInput {
  name: string;
  projectId: string;
  workspaceId: string;
  description?: string;
  mappings: { issueType: string; workflowId: string }[];
  defaultWorkflowId: string;
  createdBy: string;
}

export async function createScheme(input: CreateSchemeInput) {
  const workflow = await Workflow.findById(input.defaultWorkflowId);
  if (!workflow) throw new AppError("Default workflow not found", 404);

  for (const m of input.mappings) {
    const wf = await Workflow.findById(m.workflowId);
    if (!wf) throw new AppError(`Workflow not found for issue type: ${m.issueType}`, 404);
  }

  const scheme = await WorkflowScheme.create(input);
  return scheme;
}

export async function getSchemeById(id: string) {
  const scheme = await WorkflowScheme.findById(id);
  if (!scheme) throw new AppError("Workflow scheme not found", 404);
  return scheme;
}

export async function getProjectSchemes(projectId: string) {
  return WorkflowScheme.find({ projectId }).sort({ createdAt: -1 });
}

export async function updateScheme(id: string, input: Partial<CreateSchemeInput>) {
  const scheme = await WorkflowScheme.findById(id);
  if (!scheme) throw new AppError("Workflow scheme not found", 404);

  if (input.name !== undefined) scheme.name = input.name;
  if (input.description !== undefined) scheme.description = input.description;
  if (input.defaultWorkflowId !== undefined) {
    const wf = await Workflow.findById(input.defaultWorkflowId);
    if (!wf) throw new AppError("Default workflow not found", 404);
    scheme.defaultWorkflowId = input.defaultWorkflowId;
  }
  if (input.mappings !== undefined) {
    for (const m of input.mappings) {
      const wf = await Workflow.findById(m.workflowId);
      if (!wf) throw new AppError(`Workflow not found for issue type: ${m.issueType}`, 404);
    }
    scheme.mappings = input.mappings;
  }

  const updated = await scheme.save();
  return updated;
}

export async function deleteScheme(id: string) {
  const scheme = await WorkflowScheme.findById(id);
  if (!scheme) throw new AppError("Workflow scheme not found", 404);
  await WorkflowScheme.deleteOne({ _id: id });
}

export async function getWorkflowForIssueType(projectId: string, issueType: string) {
  const scheme = await WorkflowScheme.findOne({ projectId }).sort({ createdAt: -1 });
  if (!scheme) return null;
  const mapping = scheme.mappings.find((m) => m.issueType === issueType);
  if (mapping) {
    const wf = await Workflow.findById(mapping.workflowId);
    if (wf) return wf;
  }
  const defaultWf = await Workflow.findById(scheme.defaultWorkflowId);
  return defaultWf;
}
