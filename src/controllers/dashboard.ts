import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as dashboardService from "../services/dashboard";

export async function getStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const stats = await dashboardService.getDashboardStats(workspaceId);
    res.status(200).json({ status: "success", data: stats });
  } catch (error) {
    next(error);
  }
}

export async function getTimeline(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const timeline = await dashboardService.getTaskTimeline(workspaceId, days);
    res.status(200).json({ status: "success", data: { timeline } });
  } catch (error) {
    next(error);
  }
}

export async function getWorkload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const workload = await dashboardService.getTeamWorkload(workspaceId);
    res.status(200).json({ status: "success", data: { workload } });
  } catch (error) {
    next(error);
  }
}
