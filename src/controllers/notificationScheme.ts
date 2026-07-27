import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as notificationSchemeService from "../services/notificationScheme";

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const schemes = await notificationSchemeService.getWorkspaceSchemes(workspaceId);
    res.status(200).json({ status: "success", data: { schemes } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await notificationSchemeService.getSchemeById(id);
    res.status(200).json({ status: "success", data: { scheme } });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const scheme = await notificationSchemeService.createScheme(req.body);
    res.status(201).json({ status: "success", data: { scheme } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await notificationSchemeService.updateScheme(id, req.body);
    res.status(200).json({ status: "success", data: { scheme } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await notificationSchemeService.deleteScheme(id);
    res.status(200).json({ status: "success", message: "Scheme deleted" });
  } catch (error) {
    next(error);
  }
}
