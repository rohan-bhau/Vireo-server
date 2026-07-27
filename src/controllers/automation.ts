import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as automationService from "../services/automation";
import { refreshRuleSchedule, unscheduleRule } from "../services/cronScheduler";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rule = await automationService.createRule({
      ...req.body,
      createdBy: req.userId!,
    });
    refreshRuleSchedule(rule._id.toString());
    res.status(201).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const rule = await automationService.getRuleById(id);
    res.status(200).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function getByWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const rules = await automationService.getWorkspaceRules(workspaceId);
    res.status(200).json({ status: "success", data: { rules } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const rules = await automationService.getProjectRules(projectId);
    res.status(200).json({ status: "success", data: { rules } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const rule = await automationService.updateRule(id, req.body);
    refreshRuleSchedule(id);
    res.status(200).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function toggle(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const rule = await automationService.toggleRule(id);
    refreshRuleSchedule(id);
    res.status(200).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await automationService.deleteRule(id);
    unscheduleRule(id);
    res.status(200).json({ status: "success", message: "Rule deleted" });
  } catch (error) {
    next(error);
  }
}

export async function copy(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const rule = await automationService.copyRule(id, req.userId!);
    res.status(201).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function getAudit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const rule = await automationService.getRuleById(id);
    const entries = await automationService.getRuleAudit(rule.name);
    res.status(200).json({ status: "success", data: { entries } });
  } catch (error) {
    next(error);
  }
}

export async function parseNaturalLanguage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { description } = req.body;
    if (!description || typeof description !== "string") {
      return res.status(400).json({ status: "error", message: "Description is required" });
    }
    const result = automationService.parseNaturalLanguage(description);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
