import Task from "../models/mongoose/Task";
import Epic from "../models/mongoose/Epic";
import User from "../models/mongoose/User";
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

export async function getFieldSuggestions(field: string, query: string, workspaceId?: string) {
  const searchRegex = new RegExp(query, "i");
  const suggestions: { value: string; label: string }[] = [];

  switch (field) {
    case "assignee":
    case "reporter": {
      if (workspaceId) {
        const members = await prisma.workspaceMember.findMany({
          where: { workspaceId },
        });
        const userIds = members.map((m) => m.userId);
        const users = await User.find({ _id: { $in: userIds } }).limit(20);
        for (const u of users) {
          const name = u.name || u.email || u._id;
          if (String(name).match(searchRegex)) {
            suggestions.push({ value: String(u._id), label: String(name) });
          }
        }
      }
      break;
    }
    case "status": {
      const statuses = ["todo", "in_progress", "in_review", "done"];
      for (const s of statuses) {
        if (s.match(searchRegex)) {
          suggestions.push({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) });
        }
      }
      break;
    }
    case "type":
    case "issuetype": {
      const types = ["task", "bug", "story", "epic", "subtask"];
      for (const t of types) {
        if (t.match(searchRegex)) {
          suggestions.push({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) });
        }
      }
      break;
    }
    case "priority": {
      const priorities = ["highest", "high", "medium", "low", "lowest"];
      for (const p of priorities) {
        if (p.match(searchRegex)) {
          suggestions.push({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) });
        }
      }
      break;
    }
    case "project": {
      if (workspaceId) {
        const projects = await prisma.project.findMany({
          where: {
            workspaceId,
            OR: [{ name: { contains: query } }, { key: { contains: query } }],
          },
          take: 10,
        });
        for (const p of projects) {
          suggestions.push({ value: p.id, label: `${p.name} (${p.key})` });
        }
      }
      break;
    }
    case "labels": {
      if (workspaceId) {
        const tasks = await Task.find({
          workspaceId,
          labels: { $regex: query, $options: "i" },
        }).limit(50);
        const seen = new Set<string>();
        for (const t of tasks) {
          for (const l of t.labels) {
            if (!seen.has(l) && l.match(searchRegex)) {
              seen.add(l);
              suggestions.push({ value: l, label: l });
            }
          }
        }
      }
      break;
    }
    case "sprint": {
      if (workspaceId) {
        const sprints = await prisma.sprint.findMany({
          where: {
            workspaceId,
            name: { contains: query },
          },
          take: 10,
        });
        for (const s of sprints) {
          suggestions.push({ value: s.id, label: s.name });
        }
      }
      break;
    }
  }

  return suggestions.slice(0, 10);
}
