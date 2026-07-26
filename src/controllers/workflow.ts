import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as workflowService from "../services/workflow";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workflow = await workflowService.createWorkflow({
      ...req.body,
      createdBy: req.userId!,
    });
    res.status(201).json({ status: "success", data: { workflow } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const workflow = await workflowService.getWorkflowById(id);
    res.status(200).json({ status: "success", data: { workflow } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const workflows = await workflowService.getProjectWorkflows(projectId);
    res.status(200).json({ status: "success", data: { workflows } });
  } catch (error) {
    next(error);
  }
}

export async function getByWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const workflows = await workflowService.getWorkspaceWorkflows(workspaceId);
    res.status(200).json({ status: "success", data: { workflows } });
  } catch (error) {
    next(error);
  }
}

export async function getDefault(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const workflow = await workflowService.getDefaultWorkflow(projectId);
    res.status(200).json({ status: "success", data: { workflow } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const workflow = await workflowService.updateWorkflow(id, req.body);
    res.status(200).json({ status: "success", data: { workflow } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await workflowService.deleteWorkflow(id);
    res.status(200).json({ status: "success", message: "Workflow deleted" });
  } catch (error) {
    next(error);
  }
}

export async function seed(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { projectId, workspaceId } = req.body;
    const workflow = await workflowService.seedDefaultWorkflow(projectId, workspaceId, req.userId!);
    res.status(201).json({ status: "success", data: { workflow } });
  } catch (error) {
    next(error);
  }
}

export async function copy(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    const workflow = await workflowService.copyWorkflow(id, name);
    res.status(201).json({ status: "success", data: { workflow } });
  } catch (error) {
    next(error);
  }
}

export async function usage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const usage = await workflowService.getWorkflowUsage(id);
    res.status(200).json({ status: "success", data: usage });
  } catch (error) {
    next(error);
  }
}

export async function validateTransition(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { transitionName, taskKey } = req.body;
    const userRoles = (req as any).userRoles || [];
    const result = await workflowService.validateTransition(id, transitionName, taskKey, req.userId!, userRoles);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function executeTransition(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { transitionName, taskKey } = req.body;
    const userRoles = (req as any).userRoles || [];
    const validation = await workflowService.validateTransition(id, transitionName, taskKey, req.userId!, userRoles);
    if (!validation.valid) {
      res.status(400).json({ status: "error", message: "Transition validation failed", errors: validation.errors });
      return;
    }
    const task = await workflowService.executePostFunctions(id, transitionName, taskKey);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}
