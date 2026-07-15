import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

interface CreateWorkspaceInput {
  name: string;
  description?: string;
  ownerId: string;
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
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
  data: { name?: string; description?: string }
) {
  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data,
  });

  return workspace;
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

  return members;
}

export async function removeMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) {
    throw new AppError("Member not found", 404);
  }

  await prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: "ADMIN" | "MEMBER"
) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) {
    throw new AppError("Member not found", 404);
  }

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });

  return updated;
}
