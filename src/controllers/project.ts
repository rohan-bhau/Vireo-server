import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as projectService from "../services/project";

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, description, key, workspaceId: bodyWorkspaceId } = req.body;
    const workspaceId = (req.params.workspaceId || bodyWorkspaceId) as string;
    const project = await projectService.createProject({
      name,
      description,
      key,
      workspaceId,
      ownerId: req.userId!,
    });
    res.status(201).json({ status: "success", data: { project } });
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
    const projectId = req.params.projectId as string;
    const project = await projectService.getProjectById(projectId);
    res.status(200).json({ status: "success", data: { project } });
  } catch (error) {
    next(error);
  }
}

export async function getByWorkspace(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const projects = await projectService.getWorkspaceProjects(workspaceId);
    res.status(200).json({ status: "success", data: { projects } });
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
    const projectId = req.params.projectId as string;
    const { name, description, key } = req.body;
    const project = await projectService.updateProject(projectId, {
      name,
      description,
      key,
    });
    res.status(200).json({ status: "success", data: { project } });
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
    const projectId = req.params.projectId as string;
    await projectService.deleteProject(projectId);
    res.status(200).json({ status: "success", message: "Project deleted" });
  } catch (error) {
    next(error);
  }
}
