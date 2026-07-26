import { Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "./auth";
import PermissionScheme from "../models/mongoose/PermissionScheme";
import ProjectRole from "../models/mongoose/ProjectRole";
import IssueSecurityScheme from "../models/mongoose/IssueSecurityScheme";
import type { Permission } from "../models/mongoose/PermissionScheme";

export function requireSiteAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    if (req.userRole !== "admin") {
      throw new AppError("Site admin access required", 403);
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(...permissions: Permission[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const projectId = (req.params.projectId || req.body.projectId) as string | undefined;
      if (!projectId) {
        throw new AppError("Project ID is required for permission check", 400);
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true, permissionSchemeId: true },
      });

      if (!project) {
        throw new AppError("Project not found", 404);
      }

      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: project.workspaceId,
            userId: req.userId!,
          },
        },
      });

      if (!workspaceMember) {
        throw new AppError("You are not a member of this workspace", 403);
      }

      if (workspaceMember.role === "ADMIN") {
        req.workspaceRole = "ADMIN";
        next();
        return;
      }

      const projectRoles = await ProjectRole.find({
        projectId,
        "members.userId": req.userId!,
      });

      if (projectRoles.length === 0) {
        throw new AppError("You do not have any role in this project", 403);
      }

      const schemeId = project.permissionSchemeId;
      const permissionScheme = schemeId
        ? await PermissionScheme.findById(schemeId)
        : await PermissionScheme.findOne({ workspaceId: project.workspaceId, isDefault: true });

      if (!permissionScheme) {
        throw new AppError("No permission scheme found for this project", 403);
      }

      const userRoleNames = new Set(projectRoles.map((r) => r.name));

      const grantedPermissions = new Set<string>();
      for (const mapping of permissionScheme.mappings) {
        if (userRoleNames.has(mapping.projectRoleName)) {
          for (const perm of mapping.permissions) {
            grantedPermissions.add(perm);
          }
        }
      }

      const allGranted = permissions.every((p) => grantedPermissions.has(p));
      if (!allGranted) {
        throw new AppError("You do not have the required permission for this action", 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireProjectRole(...roleNames: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const projectId = (req.params.projectId || req.body.projectId) as string | undefined;
      if (!projectId) {
        throw new AppError("Project ID is required", 400);
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { workspaceId: true },
      });

      if (!project) {
        throw new AppError("Project not found", 404);
      }

      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: project.workspaceId,
            userId: req.userId!,
          },
        },
      });

      if (workspaceMember?.role === "ADMIN") {
        next();
        return;
      }

      const role = await ProjectRole.findOne({
        projectId,
        name: { $in: roleNames },
        "members.userId": req.userId!,
      });

      if (!role) {
        throw new AppError(
          `You must have one of these roles: ${roleNames.join(", ")}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function checkIssueSecurity(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const taskKey = (req.params.taskKey || req.body.taskKey) as string | undefined;
    if (!taskKey) {
      next();
      return;
    }

    const Task = (await import("../models/mongoose/Task")).default;
    const task = await Task.findOne({ taskKey }).select("securityLevel projectId workspaceId");
    if (!task || !task.securityLevel) {
      next();
      return;
    }

    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: task.workspaceId, userId: req.userId! },
      },
    });

    if (workspaceMember?.role === "ADMIN") {
      next();
      return;
    }

    const scheme = await IssueSecurityScheme.findById(task.securityLevel);
    if (!scheme) {
      next();
      return;
    }

    const matchingLevel = scheme.levels.find((l) => (l as any)._id?.toString() === task.securityLevel);
    if (!matchingLevel) {
      next();
      return;
    }

    const isMember = matchingLevel.members.some((m) => m.userId === req.userId);
    if (!isMember) {
      throw new AppError("You do not have permission to view this issue", 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}


