import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as labelService from "../services/label";

export async function getProjectLabels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const labels = await labelService.getProjectLabels(projectId);
    res.status(200).json({ status: "success", data: { labels } });
  } catch (error) {
    next(error);
  }
}

export async function suggestLabels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    const query = (req.query.q as string) || "";
    const labels = await labelService.suggestLabels(projectId, query);
    res.status(200).json({ status: "success", data: { labels } });
  } catch (error) {
    next(error);
  }
}

export async function getWorkspaceLabels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const labels = await labelService.getWorkspaceLabels(workspaceId);
    res.status(200).json({ status: "success", data: { labels } });
  } catch (error) {
    next(error);
  }
}

export async function mergeLabels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const { sourceLabel, targetLabel } = req.body;
    const result = await labelService.mergeLabels(projectId, sourceLabel, targetLabel);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
