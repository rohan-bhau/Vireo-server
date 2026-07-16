import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

interface CreateProjectInput {
  name: string;
  description?: string;
  key: string;
  workspaceId: string;
  ownerId: string;
}

export async function createProject(input: CreateProjectInput) {
  const existing = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: input.workspaceId, key: input.key } },
  });

  if (existing) {
    throw new AppError("A project with this key already exists in the workspace", 409);
  }

  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      key: input.key.toUpperCase(),
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
    },
  });

  const board = await prisma.board.create({
    data: {
      name: `${project.name} Board`,
      projectId: project.id,
      columns: {
        create: [
          { name: "To Do", position: 0 },
          { name: "In Progress", position: 1 },
          { name: "Done", position: 2 },
        ],
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  return { ...project, board };
}

export async function getProjectById(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      boards: {
        include: { columns: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  return project;
}

export async function getWorkspaceProjects(workspaceId: string) {
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    include: {
      boards: {
        include: { columns: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects;
}

export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string; key?: string }
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  if (data.key) {
    const existing = await prisma.project.findUnique({
      where: { workspaceId_key: { workspaceId: project.workspaceId, key: data.key } },
    });

    if (existing && existing.id !== projectId) {
      throw new AppError("A project with this key already exists in the workspace", 409);
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.key && { key: data.key.toUpperCase() }),
    },
    include: {
      boards: {
        include: { columns: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return updated;
}

export async function deleteProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  await prisma.project.delete({ where: { id: projectId } });
}
