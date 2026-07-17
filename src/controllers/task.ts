import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as taskService from "../services/task";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const task = await taskService.createTask({
      ...req.body,
      reporter: req.userId!,
    });
    res.status(201).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function getByKey(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const task = await taskService.getTaskByKey(taskKey);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const tasks = await taskService.getProjectTasks(projectId);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function getByBoard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boardId = req.params.boardId as string;
    const tasks = await taskService.getBoardTasks(boardId);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function getByColumn(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const columnId = req.params.columnId as string;
    const tasks = await taskService.getColumnTasks(columnId);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function getByWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const tasks = await taskService.getWorkspaceTasks(workspaceId);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const task = await taskService.updateTask(taskKey, req.body, req.userId!);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    await taskService.deleteTask(taskKey);
    res.status(200).json({ status: "success", message: "Task deleted" });
  } catch (error) {
    next(error);
  }
}

export async function move(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const { columnId, position } = req.body;
    const task = await taskService.moveTask(taskKey, columnId, position, req.userId!);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function addAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const task = await taskService.addAttachment(taskKey, req.body, req.userId!);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function removeAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const publicId = req.params.publicId as string;
    await taskService.removeAttachment(taskKey, publicId, req.userId!);
    res.status(200).json({ status: "success", message: "Attachment removed" });
  } catch (error) {
    next(error);
  }
}

export async function link(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const { linkedTaskKey, linkType } = req.body;
    const task = await taskService.linkTasks(taskKey, linkedTaskKey, linkType);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function unlink(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const linkedTaskKey = req.params.linkedTaskKey as string;
    const task = await taskService.unlinkTasks(taskKey, linkedTaskKey);
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function getActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const activity = await taskService.getTaskActivity(taskKey);
    res.status(200).json({ status: "success", data: { activity } });
  } catch (error) {
    next(error);
  }
}

export async function reorder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { columnId, taskIds } = req.body;
    const tasks = await taskService.reorderTasks(columnId, taskIds);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}
