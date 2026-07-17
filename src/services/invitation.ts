import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import User from "../models/mongoose/User";
import { sendInvitationEmail, sendWelcomeEmail } from "./email";

interface CreateInvitationInput {
  workspaceId: string;
  inviterId: string;
  inviteeEmail: string;
  role: "ADMIN" | "MEMBER";
  message?: string;
}

export async function createInvitation(input: CreateInvitationInput) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  const existingMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.inviteeEmail,
    },
  });

  if (existingMember) {
    throw new AppError("User is already a member of this workspace", 409);
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      inviteeEmail: input.inviteeEmail,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    throw new AppError("An active invitation already exists for this email", 409);
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      workspaceId: input.workspaceId,
      inviterId: input.inviterId,
      inviteeEmail: input.inviteeEmail,
      role: input.role,
      message: input.message,
      token,
      expiresAt,
    },
  });

  try {
    const inviter = await User.findById(input.inviterId).select("name");
    const inviterName = inviter?.name || "A team member";

    await sendInvitationEmail(
      input.inviteeEmail,
      workspace.name,
      inviterName,
      token,
      input.message
    );
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }

  return invitation;
}

export async function resendInvitation(invitationId: string, inviterId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { workspace: true },
  });

  if (!invitation) {
    throw new AppError("Invitation not found", 404);
  }

  if (invitation.status !== "PENDING") {
    throw new AppError("Invitation is no longer pending", 400);
  }

  const inviter = await User.findById(inviterId).select("name");
  const inviterName = inviter?.name || "A team member";

  try {
    await sendInvitationEmail(
      invitation.inviteeEmail,
      invitation.workspace.name,
      inviterName,
      invitation.token,
      invitation.message || undefined
    );
  } catch (error) {
    console.error("Failed to resend invitation email:", error);
    throw new AppError("Failed to send invitation email", 500);
  }
}

export async function getWorkspaceInvitations(workspaceId: string) {
  const invitations = await prisma.invitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return invitations;
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    throw new AppError("Invalid invitation token", 404);
  }

  if (invitation.status !== "PENDING") {
    throw new AppError("Invitation has already been " + invitation.status.toLowerCase(), 400);
  }

  if (new Date() > invitation.expiresAt) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw new AppError("Invitation has expired", 400);
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    },
  });

  if (existingMember) {
    throw new AppError("You are already a member of this workspace", 409);
  }

  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        invitedBy: invitation.inviterId,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    }),
  ]);
}

export async function declineInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    throw new AppError("Invalid invitation token", 404);
  }

  if (invitation.status !== "PENDING") {
    throw new AppError("Invitation has already been " + invitation.status.toLowerCase(), 400);
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "DECLINED" },
  });
}

export async function cancelInvitation(invitationId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new AppError("Invitation not found", 404);
  }

  await prisma.invitation.delete({ where: { id: invitationId } });
}

export async function getPendingInvitationsForUser(email: string) {
  const invitations = await prisma.invitation.findMany({
    where: {
      inviteeEmail: email,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    include: {
      workspace: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invitations;
}
