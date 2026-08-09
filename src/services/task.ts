import { prisma } from "../config/prisma";
import Task, { TaskStatus, TaskPriority, TaskType } from "../models/mongoose/Task";
import ActivityLog from "../models/mongoose/ActivityLog";
import { AppError } from "../utils/AppError";
import {
  notifyAssigned,
  notifyStatusChanged,
  notifyIssueCreated,
  notifyIssueUpdated,
  notifyIssueDeleted,
  notifyIssueCompleted,
} from "./notification";
import { evaluateTriggers } from "./automation";
import { checkProjectPermission, checkIssueSecurityAccess } from "./permission";

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
  components?: string[];
  fixVersion?: string;
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

  const hasPerm = await checkProjectPermission(input.reporter, projectId, "CREATE_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to create issues in this project", 403);

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
    components: input.components || [],
    fixVersion: input.fixVersion || null,
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

  evaluateTriggers("task.created", {
    taskKey: task.taskKey,
    task,
    workspaceId: input.workspaceId,
    projectId,
    actorId: input.reporter,
  });

  notifyIssueCreated(
    task.taskKey,
    task.title,
    input.reporter,
    input.workspaceId,
    projectId,
    input.reporter
  );

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

export async function getSubtasksByParent(taskKey: string) {
  return Task.find({ parentTask: taskKey }).sort({ createdAt: 1 });
}

export async function hasOpenSubtasks(taskKey: string): Promise<boolean> {
  const count = await Task.countDocuments({ parentTask: taskKey, status: { $ne: "done" } });
  return count > 0;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: string[];
  components?: string[];
  fixVersion?: string | null;
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

  const hasPerm = await checkProjectPermission(actorId, task.projectId, "EDIT_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to edit issues in this project", 403);

  const canAccess = await checkIssueSecurityAccess(actorId, task);
  if (!canAccess) throw new AppError("You do not have permission to access this issue", 403);

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

  if (input.status === "done" && oldStatus !== "done") {
    const openSubtasks = await hasOpenSubtasks(taskKey);
    if (openSubtasks) {
      throw new AppError("Cannot mark as Done: all subtasks must be completed first.", 400);
    }
  }

  if (input.title !== undefined) task.title = input.title;
  if (input.description !== undefined) task.description = input.description;
  if (input.type !== undefined) task.type = input.type;
  if (input.status !== undefined) task.status = input.status;
  if (input.priority !== undefined) task.priority = input.priority;
  if (input.assignee !== undefined) task.assignee = input.assignee;
  if (input.labels !== undefined) task.labels = input.labels;
  if (input.components !== undefined) task.components = input.components;
  if (input.fixVersion !== undefined) task.fixVersion = input.fixVersion;
  if (input.dueDate !== undefined) task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.storyPoints !== undefined) task.storyPoints = input.storyPoints;
  if (input.parentTask !== undefined) task.parentTask = input.parentTask;
  if (input.columnId !== undefined) task.columnId = input.columnId;
  if (input.position !== undefined) task.position = input.position;
  if (input.sprintId !== undefined) task.sprintId = input.sprintId;

  const updated = await task.save();

  if (input.status === "done" && oldStatus !== "done") {
    await notifyIssueCompleted(
      task.reporter || task.assignee || "",
      taskKey,
      updated.title,
      actorId,
      task.workspaceId,
      task.projectId
    ).catch(() => {});
  }

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

  evaluateTriggers("task.updated", {
    taskKey,
    task: updated,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    actorId,
  });

  if (input.status && input.status !== oldStatus) {
    evaluateTriggers("task.status_changed", {
      taskKey,
      task: updated,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      actorId,
    });
  }

  if (input.assignee !== undefined && input.assignee !== oldAssignee) {
    evaluateTriggers("task.assigned", {
      taskKey,
      task: updated,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      actorId,
    });
  }

  if (changes.length > 0) {
    notifyIssueUpdated(
      taskKey,
      task.title,
      actorId,
      task.workspaceId,
      task.projectId,
      task.assignee,
      task.reporter,
      task.watchers
    );
  }

  return updated;
}

export async function deleteTask(taskKey: string, actorId?: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  if (actorId) {
    const hasPerm = await checkProjectPermission(actorId, task.projectId, "DELETE_ISSUES");
    if (!hasPerm) throw new AppError("You do not have permission to delete issues in this project", 403);

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: task.workspaceId, userId: actorId },
      },
    });

    if (member && member.role === "EDIT" && task.reporter !== actorId) {
      throw new AppError(
        "You can only delete tasks you created. Contact a workspace admin.",
        403
      );
    }
  }

  const taskTitle = task.title;
  const taskWorkspaceId = task.workspaceId;
  const taskProjectId = task.projectId;
  const taskReporter = task.reporter;

  await ActivityLog.deleteMany({ taskId: taskKey });
  await Task.deleteOne({ taskKey });

  if (actorId) {
    notifyIssueDeleted(taskKey, taskTitle, actorId, taskWorkspaceId, taskProjectId, taskReporter);
  }
}

export async function moveTask(taskKey: string, columnId: string, position: number, actorId: string) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const hasPerm = await checkProjectPermission(actorId, task.projectId, "MOVE_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to move issues in this project", 403);

  const column = await prisma.column.findUnique({ where: { id: columnId } });

  const oldColumnId = task.columnId;
  const newStatus = column ? mapColumnToStatus(column.name) : mapColumnToStatus(columnId);

  if (newStatus === "done" && oldColumnId !== columnId) {
    const openSubtasks = await hasOpenSubtasks(taskKey);
    if (openSubtasks) {
      throw new AppError("Cannot move to Done: all subtasks must be completed first.", 400);
    }
  }

  task.columnId = columnId;
  task.position = position;
  task.status = newStatus;
  await task.save();

  if (newStatus === "done" && oldColumnId !== columnId) {
    await notifyIssueCompleted(
      task.reporter || task.assignee || "",
      taskKey,
      task.title,
      actorId,
      task.workspaceId,
      task.projectId
    ).catch(() => {});
  }

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
