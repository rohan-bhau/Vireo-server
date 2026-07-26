import Component from "../models/mongoose/Component";
import { AppError } from "../utils/AppError";
import { checkProjectPermission } from "./permission";

export async function getProjectComponents(projectId: string) {
  return Component.find({ projectId }).sort({ name: 1 });
}

export async function getComponentById(id: string) {
  const component = await Component.findById(id);
  if (!component) throw new AppError("Component not found", 404);
  return component;
}

export async function createComponent(input: {
  name: string;
  description?: string;
  projectId: string;
  lead?: string;
  defaultAssignee?: string;
  actorId: string;
}) {
  const hasPerm = await checkProjectPermission(input.actorId, input.projectId, "EDIT_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to manage components", 403);

  const existing = await Component.findOne({ projectId: input.projectId, name: input.name });
  if (existing) throw new AppError("Component with this name already exists in this project", 409);

  return Component.create({
    name: input.name,
    description: input.description || "",
    projectId: input.projectId,
    lead: input.lead || null,
    defaultAssignee: input.defaultAssignee || null,
  });
}

export async function updateComponent(
  id: string,
  input: { name?: string; description?: string; lead?: string | null; defaultAssignee?: string | null },
  actorId: string
) {
  const component = await getComponentById(id);
  const hasPerm = await checkProjectPermission(actorId, component.projectId, "EDIT_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to manage components", 403);

  if (input.name !== undefined) component.name = input.name;
  if (input.description !== undefined) component.description = input.description;
  if (input.lead !== undefined) component.lead = input.lead;
  if (input.defaultAssignee !== undefined) component.defaultAssignee = input.defaultAssignee;

  return component.save();
}

export async function deleteComponent(id: string, actorId: string) {
  const component = await getComponentById(id);
  const hasPerm = await checkProjectPermission(actorId, component.projectId, "DELETE_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to delete components", 403);

  await Component.deleteOne({ _id: id });
}
