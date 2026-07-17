import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

interface CreateSprintInput {
  name: string;
  goal?: string;
  projectId: string;
  startDate?: string;
  endDate?: string;
}

interface UpdateSprintInput {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

export async function createSprint(input: CreateSprintInput) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!project) throw new AppError("Project not found", 404);

  const sprint = await prisma.sprint.create({
    data: {
      name: input.name,
      goal: input.goal || null,
      projectId: input.projectId,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });

  return sprint;
}

export async function getSprintById(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });

  if (!sprint) throw new AppError("Sprint not found", 404);

  return sprint;
}

export async function getProjectSprints(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new AppError("Project not found", 404);

  return prisma.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateSprint(sprintId: string, input: UpdateSprintInput) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.goal !== undefined && { goal: input.goal }),
      ...(input.startDate !== undefined && { startDate: new Date(input.startDate) }),
      ...(input.endDate !== undefined && { endDate: new Date(input.endDate) }),
    },
  });

  return updated;
}

export async function deleteSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);

  await prisma.sprint.delete({ where: { id: sprintId } });
}

export async function startSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);
  if (sprint.status !== "PLANNING") {
    throw new AppError("Only PLANNING sprints can be started", 400);
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      status: "ACTIVE",
      startDate: sprint.startDate || new Date(),
    },
  });

  return updated;
}

export async function completeSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);
  if (sprint.status !== "ACTIVE") {
    throw new AppError("Only ACTIVE sprints can be completed", 400);
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      status: "COMPLETED",
      endDate: sprint.endDate || new Date(),
    },
  });

  return updated;
}

export async function assignTasksToSprint(sprintId: string, taskKeys: string[]) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);

  const Task = (await import("../models/mongoose/Task")).default;

  const result = await Task.updateMany(
    { taskKey: { $in: taskKeys } },
    { $set: { sprintId } }
  );

  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

export async function removeTasksFromSprint(sprintId: string, taskKeys: string[]) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);

  const Task = (await import("../models/mongoose/Task")).default;

  const result = await Task.updateMany(
    { taskKey: { $in: taskKeys }, sprintId },
    { $unset: { sprintId: "" } }
  );

  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

export async function getSprintTasks(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });
  if (!sprint) throw new AppError("Sprint not found", 404);

  const Task = (await import("../models/mongoose/Task")).default;

  return Task.find({ sprintId }).sort({ position: 1 });
}

export async function getBacklogTasks(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new AppError("Project not found", 404);

  const Task = (await import("../models/mongoose/Task")).default;

  return Task.find({ projectId, sprintId: null }).sort({ updatedAt: -1 });
}
