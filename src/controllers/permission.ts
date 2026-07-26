import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as permissionService from "../services/permission";
import User from "../models/mongoose/User";
import { prisma } from "../config/prisma";

export async function getPermissionSchemes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const schemes = await permissionService.getPermissionSchemes(workspaceId);
    res.json({ status: "success", data: { schemes } });
  } catch (error) { next(error); }
}

export async function getPermissionScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await permissionService.getPermissionSchemeById(id);
    res.json({ status: "success", data: { scheme } });
  } catch (error) { next(error); }
}

export async function createPermissionScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const scheme = await permissionService.createPermissionScheme({
      ...req.body,
      workspaceId,
      createdBy: req.userId!,
    });
    res.status(201).json({ status: "success", data: { scheme } });
  } catch (error) { next(error); }
}

export async function updatePermissionScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await permissionService.updatePermissionScheme(id, req.body);
    res.json({ status: "success", data: { scheme } });
  } catch (error) { next(error); }
}

export async function deletePermissionScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await permissionService.deletePermissionScheme(id);
    res.json({ status: "success", message: "Permission scheme deleted" });
  } catch (error) { next(error); }
}

export async function getProjectRoles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const roles = await permissionService.getProjectRoles(projectId);
    res.json({ status: "success", data: { roles } });
  } catch (error) { next(error); }
}

export async function createProjectRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const role = await permissionService.createProjectRole({
      ...req.body,
      projectId,
      workspaceId: req.body.workspaceId,
      createdBy: req.userId!,
    });
    res.status(201).json({ status: "success", data: { role } });
  } catch (error) { next(error); }
}

export async function updateProjectRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const role = await permissionService.updateProjectRole(id, req.body);
    res.json({ status: "success", data: { role } });
  } catch (error) { next(error); }
}

export async function deleteProjectRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await permissionService.deleteProjectRole(id);
    res.json({ status: "success", message: "Project role deleted" });
  } catch (error) { next(error); }
}

export async function addMemberToRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roleId = req.params.roleId as string;
    const role = await permissionService.addMemberToProjectRole(roleId, req.body.userId, req.userId!);
    res.json({ status: "success", data: { role } });
  } catch (error) { next(error); }
}

export async function removeMemberFromRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roleId = req.params.roleId as string;
    const userId = req.params.userId as string;
    const role = await permissionService.removeMemberFromProjectRole(roleId, userId);
    res.json({ status: "success", data: { role } });
  } catch (error) { next(error); }
}

export async function getIssueSecuritySchemes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const schemes = await permissionService.getIssueSecuritySchemes(workspaceId);
    res.json({ status: "success", data: { schemes } });
  } catch (error) { next(error); }
}

export async function getIssueSecurityScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await permissionService.getIssueSecuritySchemeById(id);
    res.json({ status: "success", data: { scheme } });
  } catch (error) { next(error); }
}

export async function createIssueSecurityScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const scheme = await permissionService.createIssueSecurityScheme({
      ...req.body,
      workspaceId,
      createdBy: req.userId!,
    });
    res.status(201).json({ status: "success", data: { scheme } });
  } catch (error) { next(error); }
}

export async function updateIssueSecurityScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await permissionService.updateIssueSecurityScheme(id, req.body);
    res.json({ status: "success", data: { scheme } });
  } catch (error) { next(error); }
}

export async function deleteIssueSecurityScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await permissionService.deleteIssueSecurityScheme(id);
    res.json({ status: "success", message: "Issue security scheme deleted" });
  } catch (error) { next(error); }
}

export async function getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    const result = await permissionService.getAllUsers(page, limit, search);
    res.json({ status: "success", data: result });
  } catch (error) { next(error); }
}

export async function updateUserRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId as string;
    const user = await permissionService.updateUserRole(userId, req.body.role);
    res.json({ status: "success", data: { user } });
  } catch (error) { next(error); }
}

export async function assignPermissionScheme(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const { permissionSchemeId } = req.body;
    const result = await permissionService.assignPermissionSchemeToProject(projectId, permissionSchemeId);
    res.json({ status: "success", data: { project: result } });
  } catch (error) { next(error); }
}

export async function getAdminOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: "admin" });
    const totalWorkspaces = await prisma.workspace.count();
    const totalProjects = await prisma.project.count();
    const PermissionSchemeModel = (await import("../models/mongoose/PermissionScheme")).default;
    const totalSchemes = await PermissionSchemeModel.countDocuments();

    res.json({
      status: "success",
      data: {
        totalUsers,
        adminUsers,
        totalWorkspaces,
        totalProjects,
        totalPermissionSchemes: totalSchemes,
      },
    });
  } catch (error) { next(error); }
}
