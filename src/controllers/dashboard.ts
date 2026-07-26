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

export async function listDashboards(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const dashboards = await dashboardService.getDashboards(workspaceId);
    res.status(200).json({ status: "success", data: { dashboards } });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const dashboardId = req.params.dashboardId as string;
    const dashboard = await dashboardService.getDashboard(dashboardId);
    res.status(200).json({ status: "success", data: { dashboard } });
  } catch (error) {
    next(error);
  }
}

export async function createDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.userId as string;
    const { name, description } = req.body;
    const dashboard = await dashboardService.createDashboard({
      name,
      description,
      workspaceId,
      ownerId: userId,
    });
    res.status(201).json({ status: "success", data: { dashboard } });
  } catch (error) {
    next(error);
  }
}

export async function updateDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const dashboardId = req.params.dashboardId as string;
    const dashboard = await dashboardService.updateDashboard(dashboardId, req.body);
    res.status(200).json({ status: "success", data: { dashboard } });
  } catch (error) {
    next(error);
  }
}

export async function deleteDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const dashboardId = req.params.dashboardId as string;
    await dashboardService.deleteDashboard(dashboardId);
    res.status(200).json({ status: "success", data: null });
  } catch (error) {
    next(error);
  }
}

export async function getGadgetData(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.userId as string;
    const data = await dashboardService.getGadgetData(workspaceId, userId);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}
