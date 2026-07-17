import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as sprintService from "../services/sprint";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, goal, projectId, startDate, endDate } = req.body;
    const sprint = await sprintService.createSprint({ name, goal, projectId, startDate, endDate });
    res.status(201).json({ status: "success", data: { sprint } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const sprint = await sprintService.getSprintById(sprintId);
    res.status(200).json({ status: "success", data: { sprint } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const sprints = await sprintService.getProjectSprints(projectId);
    res.status(200).json({ status: "success", data: { sprints } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const { name, goal, startDate, endDate } = req.body;
    const sprint = await sprintService.updateSprint(sprintId, { name, goal, startDate, endDate });
    res.status(200).json({ status: "success", data: { sprint } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    await sprintService.deleteSprint(sprintId);
    res.status(200).json({ status: "success", message: "Sprint deleted" });
  } catch (error) {
    next(error);
  }
}

export async function start(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const sprint = await sprintService.startSprint(sprintId);
    res.status(200).json({ status: "success", data: { sprint } });
  } catch (error) {
    next(error);
  }
}

export async function complete(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const sprint = await sprintService.completeSprint(sprintId);
    res.status(200).json({ status: "success", data: { sprint } });
  } catch (error) {
    next(error);
  }
}

export async function getTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const tasks = await sprintService.getSprintTasks(sprintId);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function getBacklog(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const tasks = await sprintService.getBacklogTasks(projectId);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function assignTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const { taskKeys } = req.body;
    const result = await sprintService.assignTasksToSprint(sprintId, taskKeys);
    res.status(200).json({ status: "success", data: { result } });
  } catch (error) {
    next(error);
  }
}

export async function removeTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    const { taskKeys } = req.body;
    const result = await sprintService.removeTasksFromSprint(sprintId, taskKeys);
    res.status(200).json({ status: "success", data: { result } });
  } catch (error) {
    next(error);
  }
}
