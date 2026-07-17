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
