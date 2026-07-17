import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as integrationService from "../services/integration";
import * as auditLogService from "../services/auditLog";

export async function getIntegrations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const integrations = await integrationService.getWorkspaceIntegrations(workspaceId);
    res.status(200).json({ status: "success", data: { integrations } });
  } catch (error) {
    next(error);
  }
}

export async function getIntegration(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const type = req.params.type as string;
    const integration = await integrationService.getIntegration(workspaceId, type);
    if (!integration) {
      res.status(404).json({ status: "error", message: "Integration not found" });
      return;
    }
    res.status(200).json({ status: "success", data: { integration } });
  } catch (error) {
    next(error);
  }
}

export async function createOrUpdate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { type, name, config, enabled } = req.body;
    const integration = await integrationService.createOrUpdateIntegration({
      workspaceId,
      type,
      name,
      config,
      configuredBy: req.userId!,
      enabled,
    });
    await auditLogService.recordAuditLog({
      workspaceId,
      actorId: req.userId!,
      action: "integration_updated",
      entityType: "integration",
      entityId: integration._id.toString(),
      entityName: name,
      details: { type },
      ip: req.ip,
    });
    res.status(200).json({ status: "success", data: { integration } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const type = req.params.type as string;
    await integrationService.deleteIntegration(workspaceId, type);
    await auditLogService.recordAuditLog({
      workspaceId,
      actorId: req.userId!,
      action: "integration_deleted",
      entityType: "integration",
      entityId: type,
      entityName: type,
      details: { type },
      ip: req.ip,
    });
    res.status(200).json({ status: "success", message: "Integration deleted" });
  } catch (error) {
    next(error);
  }
}

export async function toggle(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const type = req.params.type as string;
    const { enabled } = req.body;
    const integration = await integrationService.toggleIntegration(workspaceId, type, enabled);
    if (!integration) {
      res.status(404).json({ status: "error", message: "Integration not found" });
      return;
    }
    res.status(200).json({ status: "success", data: { integration } });
  } catch (error) {
    next(error);
  }
}

export async function test(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const type = req.params.type as string;
    const result = await integrationService.testIntegration(workspaceId, type);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
