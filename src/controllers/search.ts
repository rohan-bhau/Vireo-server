import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as searchService from "../services/search";
import { jqlToMongoFilter, validateJql, getSuggestions } from "../services/jql";
import Task from "../models/mongoose/Task";

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

export async function jqlSearch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = req.query.query as string;
    const workspaceId = req.query.workspaceId as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    if (!query) {
      res.status(400).json({ status: "error", message: "JQL query is required" });
      return;
    }

    const { filter, orderBy, error } = jqlToMongoFilter(query, req.userId);
    if (error) {
      res.status(400).json({ status: "error", message: error.message, position: error.position });
      return;
    }

    if (workspaceId) {
      filter.workspaceId = workspaceId;
    }

    const sortObj: Record<string, 1 | -1> = {};
    if (orderBy.length > 0) {
      for (const o of orderBy) {
        sortObj[o.field] = o.direction === "ASC" ? 1 : -1;
      }
    } else {
      sortObj.updatedAt = -1;
    }

    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort(sortObj).skip(skip).limit(limit),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        tasks,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function validateJqlEndpoint(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ status: "error", message: "JQL query is required" });
      return;
    }
    const result = validateJql(query);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function suggest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string || "";
    const type = (req.query.type as "field" | "operator" | "value") || "field";
    const workspaceId = req.query.workspaceId as string;

    const suggestions = getSuggestions(q, type, workspaceId);

    if (type === "value") {
      const field = req.query.field as string;
      if (field) {
        const dbSuggestions = await searchService.getFieldSuggestions(field, q, workspaceId);
        res.status(200).json({
          status: "success",
          data: { suggestions: [...suggestions, ...dbSuggestions] },
        });
        return;
      }
    }

    res.status(200).json({ status: "success", data: { suggestions } });
  } catch (error) {
    next(error);
  }
}
