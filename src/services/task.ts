import { prisma } from "../config/prisma";
import Task, { TaskStatus, TaskPriority, TaskType } from "../models/mongoose/Task";
import ActivityLog from "../models/mongoose/ActivityLog";
import { AppError } from "../utils/AppError";
import { notifyAssigned, notifyStatusChanged } from "./notification";

interface CreateTaskInput {
  title: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  reporter: string;
  projectId?: string;
  boardId?: string;
  columnId?: string;
  labels?: string[];
  dueDate?: string;
  storyPoints?: number;
  parentTask?: string;
  workspaceId: string;
}

async function resolveOrCreateDefaultProject(workspaceId: string): Promise<{ id: string; key: string }> {
  const existing = await prisma.project.findFirst({
    where: { workspaceId, name: "Default" },
  });
  if (existing) return { id: existing.id, key: existing.key };

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new AppError("Workspace not found", 404);

  const prefix = workspace.name
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase() || "DEF";

  const project = await prisma.project.create({
    data: {
      name: "Default",
      key: prefix,
      description: "Auto-created default project",
      workspaceId,
      ownerId: "",
    },
  });

  return { id: project.id, key: project.key };
}

export async function generateTaskKey(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404);

  const prefix = project.key;
  const lastTask = await Task.findOne({ projectId }).sort({ taskKey: -1 });

  let num = 1;
  if (lastTask) {
    const match = lastTask.taskKey.match(/-(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(num).padStart(3, "0")}`;
}

export async function createTask(input: CreateTaskInput) {
  let projectId = input.projectId;
  if (!projectId) {
    const defaultProject = await resolveOrCreateDefaultProject(input.workspaceId);
    projectId = defaultProject.id;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404);

  const taskKey = await generateTaskKey(projectId);

  const maxPosition = input.columnId
    ? await Task.countDocuments({ columnId: input.columnId })
    : 0;

  const task = await Task.create({
    taskKey,
    title: input.title,
    description: input.description || "",
    type: input.type || "task",
    status: input.status || "todo",
    priority: input.priority || "medium",
    assignee: input.assignee || null,
    reporter: input.reporter,
    projectId,
    boardId: input.boardId || null,
    columnId: input.columnId || null,
    position: maxPosition,
    labels: input.labels || [],
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    storyPoints: input.storyPoints || null,
    parentTask: input.parentTask || null,
    workspaceId: input.workspaceId,
  });

  await ActivityLog.create({
    taskId: task.taskKey,
    actorId: input.reporter,
    action: "created",
    timestamp: new Date(),
  });

  return task;
}

export async function getTaskByKey(taskKey: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);
  return task;
}

export async function getProjectTasks(projectId: string) {
  return Task.find({ projectId }).sort({ position: 1, createdAt: -1 });
}

export async function getBoardTasks(boardId: string) {
  return Task.find({ boardId }).sort({ position: 1 });
}

export async function getColumnTasks(columnId: string) {
  return Task.find({ columnId }).sort({ position: 1 });
}

export async function getWorkspaceTasks(workspaceId: string) {
  return Task.find({ workspaceId }).sort({ updatedAt: -1 });
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: string[];
  dueDate?: string | null;
  storyPoints?: number | null;
  parentTask?: string | null;
  columnId?: string | null;
  position?: number;
  sprintId?: string | null;
}

export async function updateTask(taskKey: string, input: UpdateTaskInput, actorId: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const changes: { field: string; oldValue: string; newValue: string }[] = [];

  const oldAssignee = task.assignee;
  const oldStatus = task.status;

  if (input.title !== undefined && input.title !== task.title) {
    changes.push({ field: "title", oldValue: task.title, newValue: input.title });
  }
  if (input.status !== undefined && input.status !== task.status) {
    changes.push({ field: "status", oldValue: task.status, newValue: input.status });
  }
  if (input.priority !== undefined && input.priority !== task.priority) {
    changes.push({ field: "priority", oldValue: task.priority, newValue: input.priority });
  }
  if (input.assignee !== undefined && input.assignee !== task.assignee) {
    changes.push({ field: "assignee", oldValue: task.assignee || "unassigned", newValue: input.assignee || "unassigned" });
  }
  if (input.columnId !== undefined && input.columnId !== task.columnId) {
    changes.push({ field: "column", oldValue: task.columnId || "none", newValue: input.columnId || "none" });
  }

  if (input.assignee !== undefined && input.assignee !== oldAssignee && input.assignee) {
    await notifyAssigned(taskKey, task.title, input.assignee, actorId);
  }
  if (input.status !== undefined && input.status !== oldStatus) {
    await notifyStatusChanged(taskKey, task.title, input.status, task.assignee, actorId);
  }

  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.type !== undefined) task.type = input.type;
  if (input.status !== undefined) task.status = input.status;
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.assignee !== undefined) task.assignee = input.assignee;
  if (input.labels !== undefined) task.labels = input.labels;
  if (input.dueDate !== undefined) task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.storyPoints !== undefined) task.storyPoints = input.storyPoints;
  if (input.parentTask !== undefined) task.parentTask = input.parentTask;
  if (input.columnId !== undefined) task.columnId = input.columnId;
  if (input.position !== undefined) task.position = input.position;
  if (input.sprintId !== undefined) task.sprintId = input.sprintId;

  const updated = await task.save();

  for (const change of changes) {
    const action = change.field === "status" ? "status_changed"
      : change.field === "assignee" ? "assigned"
      : "updated";

    await ActivityLog.create({
      taskId: taskKey,
      actorId,
      action,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      timestamp: new Date(),
    });
  }

  return updated;
}

export async function deleteTask(taskKey: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  await ActivityLog.deleteMany({ taskId: taskKey });
  await Task.deleteOne({ taskKey });
}

export async function moveTask(taskKey: string, columnId: string, position: number, actorId: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const column = await prisma.column.findUnique({ where: { id: columnId } });

  const oldColumnId = task.columnId;
  task.columnId = columnId;
  task.position = position;
  task.status = column ? mapColumnToStatus(column.name) : mapColumnToStatus(columnId);
  await task.save();

  if (oldColumnId !== columnId) {
    await ActivityLog.create({
      taskId: taskKey,
      actorId,
      action: "status_changed",
      field: "column",
      oldValue: oldColumnId || "none",
      newValue: columnId,
      timestamp: new Date(),
    });
  }

  return task;
}

function mapColumnToStatus(columnName: string): TaskStatus {
  const name = columnName.toLowerCase();
  if (name.includes("progress") || name.includes("doing")) return "in_progress";
  if (name.includes("review")) return "in_review";
  if (name.includes("done") || name.includes("complete")) return "done";
  return "todo";
}

export async function addAttachment(
  taskKey: string,
  attachment: { url: string; filename: string; publicId: string },
  actorId: string
) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  task.attachments.push(attachment);
  await task.save();

  await ActivityLog.create({
    taskId: taskKey,
    actorId,
    action: "attachment_added",
    field: "attachments",
    newValue: attachment.filename,
    timestamp: new Date(),
  });

  return task;
}

export async function removeAttachment(taskKey: string, publicId: string, actorId: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const attachment = task.attachments.find((a) => a.publicId === publicId);
  if (!attachment) throw new AppError("Attachment not found", 404);

  task.attachments = task.attachments.filter((a) => a.publicId !== publicId);
  await task.save();

  await ActivityLog.create({
    taskId: taskKey,
    actorId,
    action: "attachment_removed",
    field: "attachments",
    oldValue: attachment.filename,
    timestamp: new Date(),
  });
}

export async function linkTasks(
  taskKey: string,
  linkedTaskKey: string,
  linkType: "blocks" | "blocked_by" | "relates_to"
) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const linkedTask = await Task.findOne({ taskKey: linkedTaskKey });
  if (!linkedTask) throw new AppError("Linked task not found", 404);

  const existing = task.linkedTasks.find(
    (lt) => lt.taskId === linkedTaskKey && lt.type === linkType
  );
  if (existing) throw new AppError("Link already exists", 409);

  task.linkedTasks.push({ taskId: linkedTaskKey, type: linkType });
  await task.save();

  return task;
}

export async function unlinkTasks(taskKey: string, linkedTaskKey: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  task.linkedTasks = task.linkedTasks.filter((lt) => lt.taskId !== linkedTaskKey);
  await task.save();

  return task;
}

export async function getTaskActivity(taskKey: string) {
  return ActivityLog.find({ taskId: taskKey }).sort({ timestamp: -1 });
}

export async function reorderTasks(columnId: string, taskIds: string[]) {
  const tasks = await Task.find({ columnId });
  const taskMap = new Map(tasks.map((t) => [t.taskKey, t]));

  for (let i = 0; i < taskIds.length; i++) {
    const task = taskMap.get(taskIds[i]);
    if (task) {
      task.position = i;
      await task.save();
    }
  }

  return Task.find({ columnId }).sort({ position: 1 });
}
