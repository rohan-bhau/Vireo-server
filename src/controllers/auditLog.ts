import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as auditLogService from "../services/auditLog";

export async function getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { limit, offset, entityType, action, actorId } = req.query;
    const result = await auditLogService.getWorkspaceAuditLogs(workspaceId, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      entityType: entityType as string | undefined,
      action: action as string | undefined,
      actorId: actorId as string | undefined,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const log = await auditLogService.getAuditLogById(req.params.id as string);
    if (!log) {
      res.status(404).json({ status: "error", message: "Audit log not found" });
      return;
    }
    res.status(200).json({ status: "success", data: { log } });
  } catch (error) {
    next(error);
  }
}

export async function getEntityTypes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const types = await auditLogService.getAuditLogEntityTypes(workspaceId);
    res.status(200).json({ status: "success", data: { types } });
  } catch (error) {
    next(error);
  }
}

export async function getActions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const actions = await auditLogService.getAuditLogActions(workspaceId);
    res.status(200).json({ status: "success", data: { actions } });
  } catch (error) {
    next(error);
  }
}
