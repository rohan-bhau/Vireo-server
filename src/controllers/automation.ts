import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as automationService from "../services/automation";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rule = await automationService.createRule({
      ...req.body,
      createdBy: req.userId!,
    });
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
    res.status(200).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function toggle(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const rule = await automationService.toggleRule(id);
    res.status(200).json({ status: "success", data: { rule } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await automationService.deleteRule(id);
    res.status(200).json({ status: "success", message: "Rule deleted" });
  } catch (error) {
    next(error);
  }
}
