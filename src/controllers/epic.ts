import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as epicService from "../services/epic";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, description, projectId, color, priority, workspaceId } = req.body;
    const epic = await epicService.createEpic({
      name,
      description,
      projectId,
      color,
      priority,
      workspaceId,
    });
    res.status(201).json({ status: "success", data: { epic } });
  } catch (error) {
    next(error);
  }
}

export async function getByKey(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const epicKey = req.params.epicKey as string;
    const epic = await epicService.getEpicByKey(epicKey);
    res.status(200).json({ status: "success", data: { epic } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const epics = await epicService.getProjectEpics(projectId);
    res.status(200).json({ status: "success", data: { epics } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const epicKey = req.params.epicKey as string;
    const { name, description, color, status, priority } = req.body;
    const epic = await epicService.updateEpic(epicKey, {
      name,
      description,
      color,
      status,
      priority,
    });
    res.status(200).json({ status: "success", data: { epic } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const epicKey = req.params.epicKey as string;
    await epicService.deleteEpic(epicKey);
    res.status(200).json({ status: "success", message: "Epic deleted" });
  } catch (error) {
    next(error);
  }
}

export async function getByWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const epics = await epicService.getWorkspaceEpics(workspaceId);
    res.status(200).json({ status: "success", data: { epics } });
  } catch (error) {
    next(error);
  }
}
