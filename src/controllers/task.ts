import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import * as taskService from "../services/task";
import * as cloudinaryService from "../services/cloudinary";
import { checkStorageLimit } from "../services/billing";

function emitTaskEvent(event: string, boardId: string | null | undefined, workspaceId: string | null | undefined, data: unknown) {
  const io = getIO();
  if (!io) return;
  if (boardId) io.to(`board:${boardId}`).emit(event, data);
  if (workspaceId) io.to(`workspace:${workspaceId}`).emit(event, data);
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const task = await taskService.createTask({
      ...req.body,
      reporter: req.userId!,
    });
    emitTaskEvent("task-created", task.boardId, task.workspaceId, { task, actorId: req.userId });
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

export async function getSubtasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const tasks = await taskService.getSubtasksByParent(taskKey);
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const task = await taskService.updateTask(taskKey, req.body, req.userId!);
    emitTaskEvent("task-updated", task.boardId, task.workspaceId, { task, actorId: req.userId });
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const task = await taskService.getTaskByKey(taskKey);
    await taskService.deleteTask(taskKey, req.userId);
    emitTaskEvent("task-deleted", task.boardId, task.workspaceId, { taskKey });
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
    emitTaskEvent("task-moved", task.boardId, task.workspaceId, { task, actorId: req.userId });
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function addAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const task = await taskService.addAttachment(taskKey, req.body, req.userId!);
    emitTaskEvent("task-updated", task.boardId, task.workspaceId, { task });
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ status: "fail", message: "No file provided" });
      return;
    }

    if (!cloudinaryService.isCloudinaryConfigured()) {
      res.status(500).json({ status: "fail", message: "Cloudinary is not configured" });
      return;
    }

    const task = await taskService.getTaskByKey(taskKey);

    // Plan gate: reject the upload before it hits Cloudinary when the
    // workspace is at its storage limit.
    await checkStorageLimit(task.workspaceId, file.size || 0);

    const { url, publicId } = await cloudinaryService.uploadAttachmentToCloudinary(file.buffer, file.originalname, {
      projectKey: task.projectId,
    });

    const updated = await taskService.addAttachment(
      taskKey,
      { url, filename: file.originalname, publicId, size: file.size || 0 },
      req.userId!
    );
    emitTaskEvent("task-updated", updated.boardId, updated.workspaceId, { task: updated });
    res.status(200).json({ status: "success", data: { task: updated } });
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
    emitTaskEvent("task-updated", task.boardId, task.workspaceId, { task });
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
    emitTaskEvent("task-updated", task.boardId, task.workspaceId, { task });
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
    if (tasks.length > 0) {
      emitTaskEvent("task-reordered", tasks[0].boardId, tasks[0].workspaceId, { columnId, tasks });
    }
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
}
