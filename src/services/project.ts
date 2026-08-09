import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import type { ProjectTemplate, BoardType } from "@prisma/client";
import * as permissionService from "./permission";

interface CreateProjectInput {
  name: string;
  description?: string;
  key: string;
  workspaceId: string;
  ownerId: string;
  template?: ProjectTemplate;
  avatar?: string;
  isTeamManaged?: boolean;
}

export function generateProjectKey(name: string): string {
  const key = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
    .slice(0, 4) || "PROJ";
  return key.toUpperCase();
}

export function getTemplateDefaults(template: ProjectTemplate) {
  return templateDefaults[template];
}

export async function seedDefaultProject(
  workspaceId: string,
  ownerId: string,
  name: string,
  template: ProjectTemplate
) {
  const project = await prisma.project.create({
    data: {
      name,
      key: generateProjectKey(name),
      template,
      workspaceId,
      ownerId,
      isTeamManaged: true,
    },
  });

  const defaults = templateDefaults[template];

  const board = await prisma.board.create({
    data: {
      name: `${project.name} Board`,
      type: defaults.boardType,
      projectId: project.id,
      columns: {
        create: defaults.columns.map((col, i) => ({ name: col, position: i })),
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  await permissionService.ensureDefaultProjectRoles(project.id, workspaceId, ownerId);
  await permissionService.ensureDefaultPermissionScheme(workspaceId, ownerId);

  return { ...project, board };
}

const templateDefaults: Record<ProjectTemplate, { boardType: BoardType; columns: string[]; hasBacklog: boolean; hasSprints: boolean; hasTimeline: boolean }> = {
  SCRUM: { boardType: "SCRUM", columns: ["To Do", "In Progress", "In Review", "Done"], hasBacklog: true, hasSprints: true, hasTimeline: false },
  KANBAN: { boardType: "KANBAN", columns: ["To Do", "In Progress", "In Review", "Done"], hasBacklog: false, hasSprints: false, hasTimeline: false },
  BUG_TRACKING: { boardType: "SCRUM", columns: ["To Do", "In Progress", "In Review", "Done"], hasBacklog: true, hasSprints: true, hasTimeline: false },
  PROJECT_MANAGEMENT: { boardType: "KANBAN", columns: ["To Do", "In Progress", "Done"], hasBacklog: false, hasSprints: false, hasTimeline: true },
  DEVOPS: { boardType: "SCRUM", columns: ["To Do", "In Progress", "In Review", "Done"], hasBacklog: true, hasSprints: true, hasTimeline: false },
  TASK_TRACKING: { boardType: "KANBAN", columns: ["To Do", "In Progress", "Done"], hasBacklog: false, hasSprints: false, hasTimeline: false },
  BLANK: { boardType: "KANBAN", columns: ["To Do", "Done"], hasBacklog: false, hasSprints: false, hasTimeline: false },
};

export async function createProject(input: CreateProjectInput) {
  const existing = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: input.workspaceId, key: input.key } },
  });

  if (existing) {
    throw new AppError("A project with this key already exists in the workspace", 409);
  }

  const template = input.template || "SCRUM";
  const defaults = templateDefaults[template];

  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      key: input.key.toUpperCase(),
      template,
      avatar: input.avatar,
      isTeamManaged: input.isTeamManaged ?? true,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
    },
  });

  const board = await prisma.board.create({
    data: {
      name: `${project.name} Board`,
      type: defaults.boardType,
      projectId: project.id,
      columns: {
        create: defaults.columns.map((name, i) => ({ name, position: i })),
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  await permissionService.ensureDefaultProjectRoles(project.id, input.workspaceId, input.ownerId);
  await permissionService.ensureDefaultPermissionScheme(input.workspaceId, input.ownerId);

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
  data: { name?: string; description?: string; key?: string; avatar?: string; isTeamManaged?: boolean }
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
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.isTeamManaged !== undefined && { isTeamManaged: data.isTeamManaged }),
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

export const VALID_ISSUE_TYPES = ["task", "bug", "epic", "story", "subtask"] as const;
export type IssueType = (typeof VALID_ISSUE_TYPES)[number];

export async function setEnabledIssueTypes(
  workspaceId: string,
  projectId: string,
  enabled: string[]
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  if (project.workspaceId !== workspaceId) {
    throw new AppError("Project not found in this workspace", 404);
  }

  const valid = VALID_ISSUE_TYPES.filter((t) => enabled.includes(t));
  if (valid.length === 0) {
    throw new AppError("At least one issue type must remain enabled", 400);
  }

  return prisma.project.update({
    where: { id: projectId },
    data: { enabledIssueTypes: valid },
    include: {
      boards: {
        include: { columns: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function deleteProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  await prisma.project.delete({ where: { id: projectId } });
}
