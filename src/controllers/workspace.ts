import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as workspaceService from "../services/workspace";

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, description } = req.body;
    const workspace = await workspaceService.createWorkspace({
      name,
      description,
      ownerId: req.userId!,
    });
    res.status(201).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const workspace = await workspaceService.getWorkspaceById(workspaceId);
    res.status(200).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function getMyWorkspaces(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaces = await workspaceService.getUserWorkspaces(req.userId!);
    res.status(200).json({ status: "success", data: { workspaces } });
  } catch (error) {
    next(error);
  }
}

export async function update(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { name, description } = req.body;
    const workspace = await workspaceService.updateWorkspace(
      workspaceId,
      { name, description }
    );
    res.status(200).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function remove(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    await workspaceService.deleteWorkspace(workspaceId);
    res.status(200).json({ status: "success", message: "Workspace deleted" });
  } catch (error) {
    next(error);
  }
}

export async function getMembers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const members = await workspaceService.getWorkspaceMembers(workspaceId);
    res.status(200).json({ status: "success", data: { members } });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.params.userId as string;
    await workspaceService.removeMember(workspaceId, userId);
    res.status(200).json({ status: "success", message: "Member removed" });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.params.userId as string;
    const { role } = req.body;
    const member = await workspaceService.updateMemberRole(
      workspaceId,
      userId,
      role
    );
    res.status(200).json({ status: "success", data: { member } });
  } catch (error) {
    next(error);
  }
}
