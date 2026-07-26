import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as reportService from "../services/report";

export async function getBurndown(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.query.sprintId as string;
    if (!sprintId) {
      res.status(400).json({ status: "error", message: "sprintId is required" });
      return;
    }
    const data = await reportService.getBurndownData(sprintId);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getVelocity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    const sprintCount = req.query.sprintCount ? parseInt(req.query.sprintCount as string, 10) : 10;
    if (!projectId) {
      res.status(400).json({ status: "error", message: "projectId is required" });
      return;
    }
    const data = await reportService.getVelocityData(projectId, sprintCount);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getSprintReport(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.query.sprintId as string;
    if (!sprintId) {
      res.status(400).json({ status: "error", message: "sprintId is required" });
      return;
    }
    const data = await reportService.getSprintReport(sprintId);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getCumulativeFlow(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    const weeks = req.query.weeks ? parseInt(req.query.weeks as string, 10) : 12;
    if (!projectId) {
      res.status(400).json({ status: "error", message: "projectId is required" });
      return;
    }
    const data = await reportService.getCumulativeFlowData(projectId, weeks);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getControlChart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
    if (!projectId) {
      res.status(400).json({ status: "error", message: "projectId is required" });
      return;
    }
    const data = await reportService.getControlChartData(projectId, days);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getCreatedVsResolved(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    const weeks = req.query.weeks ? parseInt(req.query.weeks as string, 10) : 12;
    if (!projectId) {
      res.status(400).json({ status: "error", message: "projectId is required" });
      return;
    }
    const data = await reportService.getCreatedVsResolved(projectId, weeks);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getAverageAge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      res.status(400).json({ status: "error", message: "projectId is required" });
      return;
    }
    const data = await reportService.getAverageAge(projectId);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}

export async function getTimeToResolution(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      res.status(400).json({ status: "error", message: "projectId is required" });
      return;
    }
    const data = await reportService.getTimeToResolution(projectId);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
}
