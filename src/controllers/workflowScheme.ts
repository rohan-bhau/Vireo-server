import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as workflowSchemeService from "../services/workflowScheme";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const scheme = await workflowSchemeService.createScheme({
      ...req.body,
      createdBy: req.userId!,
    });
    res.status(201).json({ status: "success", data: { scheme } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await workflowSchemeService.getSchemeById(id);
    res.status(200).json({ status: "success", data: { scheme } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const schemes = await workflowSchemeService.getProjectSchemes(projectId);
    res.status(200).json({ status: "success", data: { schemes } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const scheme = await workflowSchemeService.updateScheme(id, req.body);
    res.status(200).json({ status: "success", data: { scheme } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await workflowSchemeService.deleteScheme(id);
    res.status(200).json({ status: "success", message: "Workflow scheme deleted" });
  } catch (error) {
    next(error);
  }
}
