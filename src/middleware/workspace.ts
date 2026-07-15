import { Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "./auth";

export async function requireWorkspaceMember(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = (req.params.workspaceId || req.params.id) as string;
    if (!workspaceId) {
      throw new AppError("Workspace ID is required", 400);
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.userId!,
        },
      },
    });

    if (!member) {
      throw new AppError("You are not a member of this workspace", 403);
    }

    req.workspaceRole = member.role;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireWorkspaceRole(...roles: ("ADMIN" | "MEMBER")[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.workspaceRole) {
      throw new AppError("Workspace role not resolved", 403);
    }

    if (!roles.includes(req.workspaceRole)) {
      throw new AppError("You do not have permission to perform this action", 403);
    }

    next();
  };
}
