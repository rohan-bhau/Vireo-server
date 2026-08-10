import mongoose from "mongoose";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import User from "../models/mongoose/User";
import Task from "../models/mongoose/Task";
import Comment from "../models/mongoose/Comment";
import ActivityLog from "../models/mongoose/ActivityLog";
import Epic from "../models/mongoose/Epic";
import Component from "../models/mongoose/Component";
import Version from "../models/mongoose/Version";
import Group from "../models/mongoose/Group";
import Dashboard from "../models/mongoose/Dashboard";
import SavedFilter from "../models/mongoose/SavedFilter";
import Subscription from "../models/mongoose/Subscription";
import Notification from "../models/mongoose/Notification";
import Conversation from "../models/mongoose/Conversation";
import { getIO } from "../socket";
import { notifyMemberAdded, notifyRoleChanged } from "./notification";
import * as projectService from "./project";
import type { ProjectTemplate } from "@prisma/client";

interface CreateWorkspaceInput {
  name: string;
  description?: string;
  ownerId: string;
  template?: ProjectTemplate;
  avatar?: string;
}

const AVATAR_PRESET_COUNT = 12;

export function generateWorkspaceAvatar(name: string): string {
  let hash = 0;
  for (const ch of Array.from(name.trim() || "W")) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return `/avatars/workspace-${(hash % AVATAR_PRESET_COUNT) + 1}.svg`;
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const template = input.template || "KANBAN";

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      description: input.description,
      avatar: input.avatar || generateWorkspaceAvatar(input.name),
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
      workspace: {
        include: {
          members: true,
        },
      },
    },
  });

  const workspaces = memberships.map((m) => m.workspace);

  const userIds = Array.from(
    new Set(workspaces.flatMap((w) => w.members.map((m) => m.userId)))
  );

  let users: any[] = [];
  if (userIds.length > 0) {
    users = await User.find({
      _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).select("name email avatar");
  }
  const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

  return workspaces.map((w) => ({
    ...w,
    members: w.members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      invitedBy: m.invitedBy,
      user: userMap.get(m.userId) || null,
    })),
  }));
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; description?: string; template?: ProjectTemplate; avatar?: string }
) {
  const updateData: { name?: string; description?: string; template?: ProjectTemplate; avatar?: string } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.template !== undefined) updateData.template = data.template;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;

  if (updateData.name !== undefined && updateData.avatar === undefined) {
    const existing = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { avatar: true },
    });
    if (
      existing?.avatar?.startsWith("data:image/svg+xml") ||
      existing?.avatar?.startsWith("/avatars/workspace-")
    ) {
      updateData.avatar = generateWorkspaceAvatar(updateData.name);
    }
  }

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

export async function deleteWorkspace(workspaceId: string, userId?: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: true, projects: true },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  if (userId && workspace.ownerId !== userId) {
    throw new AppError("Only the workspace owner can delete this workspace", 403);
  }

  const memberIds = workspace.members.map((m) => m.userId);
  const projectIds = workspace.projects.map((p) => p.id);

  const taskKeys = (
    await Task.find({ workspaceId }).select("taskKey")
  ).map((t) => t.taskKey);

  const conversations = await Conversation.find({ workspaceId }).select("_id");
  const conversationIds = conversations.map((c) => c._id.toString());

  await Promise.all([
    Task.deleteMany({ workspaceId }),
    Comment.deleteMany({ taskId: { $in: taskKeys } }),
    ActivityLog.deleteMany({ taskId: { $in: taskKeys } }),
    Epic.deleteMany({ workspaceId }),
    Component.deleteMany({ projectId: { $in: projectIds } }),
    Version.deleteMany({ projectId: { $in: projectIds } }),
    Group.deleteMany({ workspaceId }),
    Dashboard.deleteMany({ workspaceId }),
    SavedFilter.deleteMany({ workspaceId }),
    Subscription.deleteMany({ workspaceId }),
    Notification.deleteMany({
      $or: [
        { workspaceId },
        { taskId: { $in: taskKeys } },
        { projectId: { $in: projectIds } },
      ],
    }),
    Conversation.deleteMany({ workspaceId }),
    import("../models/mongoose/Message").then(({ default: Message }) =>
      Message.deleteMany({ conversationId: { $in: conversationIds } })
    ),
    import("../models/mongoose/ProjectRole").then(({ default: ProjectRole }) =>
      ProjectRole.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/PermissionScheme").then(({ default: PermissionScheme }) =>
      PermissionScheme.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/IssueSecurityScheme").then(({ default: IssueSecurityScheme }) =>
      IssueSecurityScheme.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/Workflow").then(({ default: Workflow }) =>
      Workflow.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/WorkflowScheme").then(({ default: WorkflowScheme }) =>
      WorkflowScheme.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/NotificationScheme").then(({ default: NotificationScheme }) =>
      NotificationScheme.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/AutomationRule").then(({ default: AutomationRule }) =>
      AutomationRule.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/Integration").then(({ default: Integration }) =>
      Integration.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/AuditLog").then(({ default: AuditLog }) =>
      AuditLog.deleteMany({ workspaceId })
    ),
    import("../models/mongoose/WebhookLog").then(({ default: WebhookLog }) =>
      WebhookLog.deleteMany({ workspaceId })
    ),
  ]);

  await prisma.workspace.delete({ where: { id: workspaceId } });

  const io = getIO();
  if (io) {
    for (const memberId of memberIds) {
      io.to(`user:${memberId}`).emit("workspace-removed", { workspaceId });
    }
    io.to(`workspace:${workspaceId}`).emit("workspace-deleted", { workspaceId });
  }
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

  const io = getIO();
  if (io) {
    io.to(`user:${userId}`).emit("workspace-removed", { workspaceId });
    io.to(`workspace:${workspaceId}`).emit("workspace-member-removed", {
      workspaceId,
      userId,
    });
  }
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: "ADMIN" | "EDIT" | "VIEW",
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

  if (workspace && actorId !== workspace.ownerId) {
    if (member.role === "ADMIN" || role === "ADMIN") {
      throw new AppError(
        "Only the workspace owner can change admin roles",
        403
      );
    }
  }

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });

  if (updated.role === role && role !== member.role) {
    await notifyRoleChanged(userId, actorId, workspaceId, role);
  }

  const io = getIO();
  if (io) {
    io.to(`workspace:${workspaceId}`).emit("workspace-member-role-changed", {
      workspaceId,
      userId,
      role,
    });
  }

  return updated;
}

export async function transferOwnership(
  workspaceId: string,
  newOwnerId: string,
  actorId: string
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: true },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  if (workspace.ownerId !== actorId) {
    throw new AppError("Only the workspace owner can transfer ownership", 403);
  }

  if (newOwnerId === workspace.ownerId) {
    throw new AppError("This member already owns the workspace", 400);
  }

  const targetMember = workspace.members.find((m) => m.userId === newOwnerId);
  if (!targetMember) {
    throw new AppError("The selected user is not a member of this workspace", 400);
  }

  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { ownerId: newOwnerId },
    }),
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
      data: { role: "ADMIN" },
    }),
  ]);

  const io = getIO();
  if (io) {
    io.to(`workspace:${workspaceId}`).emit("workspace-owner-changed", {
      workspaceId,
      ownerId: newOwnerId,
    });
  }

  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: true },
  });
}
