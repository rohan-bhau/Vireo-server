import Task from "../models/mongoose/Task";
import Epic from "../models/mongoose/Epic";
import { prisma } from "../config/prisma";

interface SearchQuery {
  q?: string;
  workspaceId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  sprintId?: string;
  dueDateBefore?: string;
  dueDateAfter?: string;
  hasDueDate?: boolean;
  hasAssignee?: boolean;
  storyPointsMin?: number;
  storyPointsMax?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

export async function searchTasks(query: SearchQuery) {
  const filter: any = {};

  if (query.workspaceId) filter.workspaceId = query.workspaceId;
  if (query.projectId) filter.projectId = query.projectId;
  if (query.status) filter.status = { $in: query.status.split(",") };
  if (query.priority) filter.priority = { $in: query.priority.split(",") };
  if (query.type) filter.type = { $in: query.type.split(",") };
  if (query.assignee) filter.assignee = query.assignee;
  if (query.reporter) filter.reporter = query.reporter;
  if (query.sprintId) filter.sprintId = query.sprintId;
  if (query.labels && query.labels.length > 0) {
    filter.labels = { $in: query.labels };
  }
  if (query.hasAssignee === true) filter.assignee = { $ne: null };
  if (query.hasAssignee === false) filter.assignee = null;

  if (query.dueDateBefore || query.dueDateAfter) {
    filter.dueDate = {};
    if (query.dueDateBefore) filter.dueDate.$lte = new Date(query.dueDateBefore);
    if (query.dueDateAfter) filter.dueDate.$gte = new Date(query.dueDateAfter);
  }
  if (query.hasDueDate === true) filter.dueDate = { $ne: null };
  if (query.hasDueDate === false) filter.dueDate = null;

  if (query.storyPointsMin !== undefined || query.storyPointsMax !== undefined) {
    filter.storyPoints = {};
    if (query.storyPointsMin !== undefined) filter.storyPoints.$gte = query.storyPointsMin;
    if (query.storyPointsMax !== undefined) filter.storyPoints.$lte = query.storyPointsMax;
  }

  if (query.q) {
    const searchRegex = new RegExp(query.q, "i");
    filter.$or = [
      { title: searchRegex },
      { taskKey: searchRegex },
      { description: searchRegex },
    ];
  }

  const sortField = query.sortField || "updatedAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 50));
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);

  return {
    tasks,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function advancedFilterTasks(workspaceId: string, conditions: FilterCondition[], options?: {
  sortField?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  const filter: any = { workspaceId };

  for (const condition of conditions) {
    const fieldPath = condition.field;
    const op = condition.operator;
    const val = condition.value;

    switch (op) {
      case "equals":
        filter[fieldPath] = val;
        break;
      case "not_equals":
        filter[fieldPath] = { $ne: val };
        break;
      case "contains":
        filter[fieldPath] = { $regex: val, $options: "i" };
        break;
      case "not_contains":
        filter[fieldPath] = { $not: { $regex: val, $options: "i" } };
        break;
      case "in":
        filter[fieldPath] = { $in: val.split(",") };
        break;
      case "not_in":
        filter[fieldPath] = { $nin: val.split(",") };
        break;
      case "greater_than":
        filter[fieldPath] = { $gt: isNaN(Number(val)) ? val : Number(val) };
        break;
      case "less_than":
        filter[fieldPath] = { $lt: isNaN(Number(val)) ? val : Number(val) };
        break;
      case "is_empty":
        filter[fieldPath] = { $in: [null, ""] };
        break;
      case "is_not_empty":
        filter[fieldPath] = { $nin: [null, ""] };
        break;
      case "date_before":
        filter[fieldPath] = { ...filter[fieldPath], $lte: new Date(val) };
        break;
      case "date_after":
        filter[fieldPath] = { ...filter[fieldPath], $gte: new Date(val) };
        break;
    }
  }

  const sortField = options?.sortField || "updatedAt";
  const sortOrder = options?.sortOrder === "asc" ? 1 : -1;
  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(100, Math.max(1, options?.limit || 50));
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);

  return {
    tasks,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function globalSearch(userId: string, query: string) {
  const searchRegex = new RegExp(query, "i");

  const userWorkspaces = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });

  const workspaceIds = userWorkspaces.map((wm) => wm.workspaceId);

  const [tasks, epics, workspaces, projects] = await Promise.all([
    Task.find({
      workspaceId: { $in: workspaceIds },
      $or: [
        { title: searchRegex },
        { taskKey: searchRegex },
        { description: searchRegex },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(20),

    Epic.find({
      workspaceId: { $in: workspaceIds },
      $or: [
        { name: searchRegex },
        { epicKey: searchRegex },
        { description: searchRegex },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(10),

    prisma.workspace.findMany({
      where: {
        id: { in: workspaceIds },
        name: { contains: query },
      },
      take: 5,
    }),

    prisma.project.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        OR: [
          { name: { contains: query } },
          { key: { contains: query } },
        ],
      },
      take: 5,
    }),
  ]);

  const members = userWorkspaces.map((wm) => ({
    workspaceId: wm.workspaceId,
    workspaceName: wm.workspace.name,
  }));

  return {
    tasks,
    epics,
    workspaces,
    projects,
    total: tasks.length + epics.length + workspaces.length + projects.length,
  };
}
