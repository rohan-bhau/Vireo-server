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

export async function getWebhookLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const webhookId = req.query.webhookId as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await integrationService.getWebhookLogs(workspaceId, webhookId, limit);
    res.status(200).json({ status: "success", data: { logs } });
  } catch (error) {
    next(error);
  }
}

export async function getGitHubData(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const issueKey = req.query.issueKey as string;
    if (!issueKey) {
      res.status(400).json({ status: "error", message: "issueKey query parameter required" });
      return;
    }
    const [branches, commits, prs] = await Promise.all([
      Promise.resolve([]),
      integrationService.getGitHubCommits(workspaceId, issueKey),
      integrationService.getGitHubPRs(workspaceId, issueKey),
    ]);
    res.status(200).json({ status: "success", data: { branches, commits, prs } });
  } catch (error) {
    next(error);
  }
}

export async function syncGitHubBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { issueKey, branchName } = req.body;
    if (!issueKey || !branchName) {
      res.status(400).json({ status: "error", message: "issueKey and branchName required" });
      return;
    }
    const result = await integrationService.syncGitHubIssue(workspaceId, issueKey, branchName);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { channel, text } = req.body;
    if (!channel || !text) {
      res.status(400).json({ status: "error", message: "channel and text required" });
      return;
    }
    const result = await integrationService.sendSlackMessage(workspaceId, channel, text);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function createSlackIssue(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { channel, title } = req.body;
    if (!channel || !title) {
      res.status(400).json({ status: "error", message: "channel and title required" });
      return;
    }
    const issue = await integrationService.createSlackIssue(workspaceId, channel, title);
    res.status(200).json({ status: "success", data: { issue } });
  } catch (error) {
    next(error);
  }
}

export async function listWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const webhooks = await integrationService.getWebhookIntegrations(workspaceId);
    res.status(200).json({ status: "success", data: { webhooks } });
  } catch (error) {
    next(error);
  }
}

export async function createWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { config } = req.body;
    if (!config) {
      res.status(400).json({ status: "error", message: "config required" });
      return;
    }
    const webhook = await integrationService.createWebhookIntegration(workspaceId, config, req.userId!);
    await auditLogService.recordAuditLog({
      workspaceId,
      actorId: req.userId!,
      action: "webhook_created",
      entityType: "integration",
      entityId: webhook._id.toString(),
      entityName: webhook.name,
      details: { url: config.url },
      ip: req.ip,
    });
    res.status(201).json({ status: "success", data: { webhook } });
  } catch (error) {
    next(error);
  }
}

export async function testWebhookEndpoint(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { url, payload } = req.body;
    if (!url) {
      res.status(400).json({ status: "error", message: "url required" });
      return;
    }
    const result = await integrationService.testWebhook(url, payload || {});
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
