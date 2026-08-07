import mongoose from "mongoose";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import User from "../models/mongoose/User";
import { notifyMemberAdded, notifyRoleChanged } from "./notification";
import * as projectService from "./project";
import type { ProjectTemplate } from "@prisma/client";

interface CreateWorkspaceInput {
  name: string;
  description?: string;
  ownerId: string;
  template?: ProjectTemplate;
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const template = input.template || "KANBAN";

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      template,
      members: {
        create: {
          userId: input.ownerId,
          role: "ADMIN",
          invitedBy: input.ownerId,
        },
      },
    },
    include: {
      members: true,
    },
  });

  try {
    await projectService.seedDefaultProject(
      workspace.id,
      input.ownerId,
      input.name,
      template
    );
  } catch (err) {
    // Non-fatal: board seeding failure should not block workspace creation.
    console.error("Failed to seed default project:", err);
  }

  return workspace;
}

export async function getWorkspaceById(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: true,
    },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  return workspace;
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
  });

  return memberships.map((m) => m.workspace);
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; description?: string; template?: ProjectTemplate }
) {
  const updateData: { name?: string; description?: string; template?: ProjectTemplate } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.template !== undefined) updateData.template = data.template;

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: updateData,
  });

  return workspace;
}

export async function getOrSeedDefaultProject(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  const existing = await prisma.project.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: { boards: { include: { columns: { orderBy: { position: "asc" } } } } },
  });

  if (existing) {
    return existing;
  }

  const seeded = await projectService.seedDefaultProject(
    workspaceId,
    workspace.ownerId,
    workspace.name,
    (workspace.template || "KANBAN") as ProjectTemplate
  );

  return prisma.project.findFirst({
    where: { id: seeded.id },
    include: { boards: { include: { columns: { orderBy: { position: "asc" } } } } },
  });
}

export async function deleteWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function getWorkspaceMembers(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
  });

  const userIds = members.map((m) => new mongoose.Types.ObjectId(m.userId));
  const users = await User.find({
    _id: { $in: userIds },
  }).select("name email avatar");

  const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

  return members.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
    invitedBy: m.invitedBy,
    user: userMap.get(m.userId) || null,
  }));
}

export async function removeMember(workspaceId: string, userId: string, actorId?: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) {
    throw new AppError("Member not found", 404);
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  if (workspace && userId === workspace.ownerId) {
    throw new AppError("You cannot remove the workspace owner", 400);
  }

  if (workspace && actorId && member.role === "ADMIN" && actorId !== workspace.ownerId) {
    throw new AppError("Only the workspace owner can remove admins", 403);
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: "ADMIN" | "MEMBER" | "VIEWER",
  actorId: string
) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) {
    throw new AppError("Member not found", 404);
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  if (workspace && userId === workspace.ownerId) {
    throw new AppError("You cannot change the workspace owner's role", 400);
  }

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });

  if (updated.role === role && role !== member.role) {
    await notifyRoleChanged(userId, actorId, workspaceId, role);
  }

  return updated;
}
