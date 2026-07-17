import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as searchService from "../services/search";

export async function search(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await searchService.searchTasks({
      ...req.query,
      workspaceId: req.query.workspaceId as string,
      projectId: req.query.projectId as string,
      q: req.query.q as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    } as any);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function advancedFilter(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { workspaceId, conditions, sortField, sortOrder, page, limit } = req.body;
    const result = await searchService.advancedFilterTasks(workspaceId, conditions, {
      sortField,
      sortOrder,
      page,
      limit,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function globalSearch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      res.status(200).json({ status: "success", data: { tasks: [], epics: [], workspaces: [], projects: [], total: 0 } });
      return;
    }
    const result = await searchService.globalSearch(req.userId!, query);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
