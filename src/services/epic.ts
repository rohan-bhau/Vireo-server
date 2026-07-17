import { prisma } from "../config/prisma";
import Epic, { EpicStatus, EpicPriority } from "../models/mongoose/Epic";
import { AppError } from "../utils/AppError";

interface CreateEpicInput {
  name: string;
  description?: string;
  projectId: string;
  color?: string;
  priority?: EpicPriority;
  workspaceId: string;
}

interface UpdateEpicInput {
  name?: string;
  description?: string;
  color?: string;
  status?: EpicStatus;
  priority?: EpicPriority;
}

async function generateEpicKey(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404);

  const prefix = project.key;
  const lastEpic = await Epic.findOne({ projectId }).sort({ epicKey: -1 });

  let num = 1;
  if (lastEpic) {
    const match = lastEpic.epicKey.match(/-(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-EPIC-${String(num).padStart(3, "0")}`;
}

export async function createEpic(input: CreateEpicInput) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) throw new AppError("Project not found", 404);

  const epicKey = await generateEpicKey(input.projectId);

  const epic = await Epic.create({
    epicKey,
    name: input.name,
    description: input.description || "",
    projectId: input.projectId,
    color: input.color || "#6366f1",
    priority: input.priority || "medium",
    workspaceId: input.workspaceId,
  });

  return epic;
}

export async function getEpicByKey(epicKey: string) {
  const epic = await Epic.findOne({ epicKey });
  if (!epic) throw new AppError("Epic not found", 404);
  return epic;
}

export async function getProjectEpics(projectId: string) {
  return Epic.find({ projectId }).sort({ createdAt: -1 });
}

export async function updateEpic(epicKey: string, input: UpdateEpicInput) {
  const epic = await Epic.findOne({ epicKey });
  if (!epic) throw new AppError("Epic not found", 404);

  if (input.name !== undefined) epic.name = input.name;
  if (input.description !== undefined) epic.description = input.description;
  if (input.color !== undefined) epic.color = input.color;
  if (input.status !== undefined) epic.status = input.status;
  if (input.priority !== undefined) epic.priority = input.priority;

  return epic.save();
}

export async function deleteEpic(epicKey: string) {
  const epic = await Epic.findOne({ epicKey });
  if (!epic) throw new AppError("Epic not found", 404);

  await Epic.deleteOne({ epicKey });
}

export async function getWorkspaceEpics(workspaceId: string) {
  return Epic.find({ workspaceId }).sort({ updatedAt: -1 });
}
