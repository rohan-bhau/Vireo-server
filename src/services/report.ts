import { prisma } from "../config/prisma";
import Task from "../models/mongoose/Task";
import ActivityLog from "../models/mongoose/ActivityLog";

export async function getBurndownData(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new Error("Sprint not found");

  const tasks = await Task.find({ sprintId }).lean();
  const totalPoints = tasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);

  const activity = await ActivityLog.find({
    taskId: { $exists: true },
    action: { $in: ["status_changed", "created", "updated"] },
    timestamp: { $gte: sprint.startDate || (sprint as any).createdAt, $lte: sprint.endDate || new Date() },
  }).sort({ timestamp: 1 }).lean();

  const startDate = sprint.startDate || (sprint as any).createdAt;
  const endDate = sprint.endDate || new Date();
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const dailyData: { day: number; date: string; ideal: number; actual: number }[] = [];

  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    const ideal = totalPoints - (totalPoints / totalDays) * day;

    const remaining = tasks.filter((t) => {
      const statusChange = (activity as any[]).find(
        (a: any) =>
          a.taskId === t.taskKey &&
          new Date(a.timestamp) <= date &&
          a.action === "status_changed"
      );
      if (statusChange) {
        const newStatus = (statusChange as any).newValue || "";
        return newStatus !== "done";
      }
      return t.status !== "done";
    });
    const actual = remaining.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);

    dailyData.push({
      day,
      date: date.toISOString().split("T")[0],
      ideal: Math.round(ideal * 10) / 10,
      actual: Math.round(actual * 10) / 10,
    });
  }

  return {
    sprintId,
    sprintName: sprint.name,
    totalDays,
    totalPoints,
    dailyData,
    status: sprint.status === "ACTIVE" ? "active" : sprint.status === "COMPLETED" ? "completed" : "planned",
    sprintStatus: sprint.status,
  };
}

export async function getVelocityData(projectId: string, sprintCount: number = 10) {
  const sprints = await prisma.sprint.findMany({
    where: { projectId, status: "COMPLETED" },
    orderBy: { endDate: "desc" },
    take: sprintCount,
  });

  const data = await Promise.all(
    sprints.map(async (sprint) => {
      const tasks = await Task.find({ sprintId: sprint.id }).lean();
      const totalPoints = tasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);
      const completedPoints = tasks
        .filter((t) => t.status === "done")
        .reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);
      return {
        sprintId: sprint.id,
        name: sprint.name,
        totalPoints,
        completedPoints,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "done").length,
        startDate: sprint.startDate?.toISOString() || null,
        endDate: sprint.endDate?.toISOString() || null,
      };
    })
  );

  data.reverse();

  const avgVelocity =
    data.length > 0
      ? Math.round(data.reduce((s, d) => s + d.completedPoints, 0) / data.length)
      : 0;

  return { sprints: data, avgVelocity, sprintCount: data.length };
}

export async function getSprintReport(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new Error("Sprint not found");

  const tasks = await Task.find({ sprintId }).lean();
  const allProjectTasks = await Task.find({ projectId: sprint.projectId }).lean();

  const planned = tasks.filter((t) => {
    const created = new Date((t as any).createdAt);
    return !sprint.startDate || created <= sprint.startDate;
  });
  const added = tasks.filter((t) => {
    const created = new Date((t as any).createdAt);
    return sprint.startDate && created > sprint.startDate;
  });
  const completed = tasks.filter((t) => t.status === "done");
  const pushed = tasks.filter(
    (t) => t.status !== "done" && sprint.endDate && new Date() > sprint.endDate
  );
  const removed = allProjectTasks.filter(
    (t) => (t as any).sprintId === sprintId && !tasks.find((st) => (st as any)._id.toString() === (t as any)._id.toString())
  );

  const plannedPoints = planned.reduce((s, t) => s + ((t as any).storyPoints || 0), 0);
  const addedPoints = added.reduce((s, t) => s + ((t as any).storyPoints || 0), 0);
  const completedPoints = completed.reduce((s, t) => s + ((t as any).storyPoints || 0), 0);
  const pushedPoints = pushed.reduce((s, t) => s + ((t as any).storyPoints || 0), 0);
  const removedPoints = removed.reduce((s, t) => s + ((t as any).storyPoints || 0), 0);
  const totalPlanned = plannedPoints + addedPoints;

  return {
    sprintId,
    sprintName: sprint.name,
    planned: { count: planned.length, points: plannedPoints },
    added: { count: added.length, points: addedPoints },
    completed: { count: completed.length, points: completedPoints },
    pushed: { count: pushed.length, points: pushedPoints },
    removed: { count: removed.length, points: removedPoints },
    totalPlanned: { points: totalPlanned },
    completion: totalPlanned > 0 ? Math.round((completedPoints / totalPlanned) * 100) : 0,
    issues: tasks.map((t) => ({
      key: t.taskKey,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      storyPoints: (t as any).storyPoints || 0,
      assignee: t.assignee,
      outcome: t.status === "done" ? "completed" : sprint.endDate && new Date() > sprint.endDate ? "pushed" : "in_progress",
    })),
  };
}

export async function getCumulativeFlowData(projectId: string, weeks: number = 12) {
  const tasks = await Task.find({ projectId }).lean();
  const statuses = ["todo", "in_progress", "in_review", "done"];
  const statusLabels: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    in_review: "In Review",
    done: "Done",
  };

  const data: { date: string; counts: Record<string, number> }[] = [];
  const now = new Date();

  for (let i = weeks; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    const dateStr = date.toISOString().split("T")[0];
    const weekEnd = new Date(date);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const counts: Record<string, number> = {};
    for (const status of statuses) {
      counts[status] = tasks.filter((t) => {
        const createdBefore = new Date((t as any).createdAt) <= weekEnd;
        const doneAfter = t.status === "done" ? new Date((t as any).updatedAt) > weekEnd : true;
        return createdBefore && doneAfter;
      }).length;
    }

    data.push({ date: dateStr, counts });
  }

  return {
    projectId,
    weeks,
    statuses: statuses.map((s) => ({ key: s, label: statusLabels[s] })),
    data,
  };
}

export async function getControlChartData(projectId: string, days: number = 90) {
  const tasks = await Task.find({
    projectId,
    status: "done",
  }).lean();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const issues = (tasks as any[])
    .filter((t: any) => new Date(t.updatedAt) >= since)
    .map((t: any) => {
      const created = new Date(t.createdAt).getTime();
      const done = new Date(t.updatedAt).getTime();
      const cycleTimeMs = done - created;
      const cycleTimeDays = Math.round((cycleTimeMs / (1000 * 60 * 60 * 24)) * 10) / 10;
      return {
        key: t.taskKey,
        title: t.title,
        type: t.type,
        priority: t.priority,
        assignee: t.assignee,
        cycleTime: cycleTimeDays,
        completedDate: t.updatedAt,
      };
    })
    .sort((a: any, b: any) => new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime());

  const times = issues.map((i: any) => i.cycleTime);
  const avg =
    times.length > 0
      ? Math.round((times.reduce((s: number, t: number) => s + t, 0) / times.length) * 10) / 10
      : 0;
  const variance =
    times.length > 0
      ? times.reduce((s: number, t: number) => s + Math.pow(t - avg, 2), 0) / times.length
      : 0;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  return {
    projectId,
    days,
    issues,
    avgCycleTime: avg,
    stdDev,
    upperBand: Math.round((avg + stdDev) * 10) / 10,
    lowerBand: Math.round(Math.max(0, avg - stdDev) * 10) / 10,
  };
}

export async function getCreatedVsResolved(projectId: string, weeks: number = 12) {
  const tasks = await Task.find({ projectId }).lean();
  const now = new Date();

  const data: { date: string; created: number; resolved: number }[] = [];

  for (let i = weeks; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const dateStr = weekStart.toISOString().split("T")[0];

    const cumulativeCreated = (tasks as any[]).filter((t: any) => new Date(t.createdAt) <= weekEnd).length;
    const cumulativeResolved = (tasks as any[]).filter(
      (t: any) => t.status === "done" && new Date(t.updatedAt) <= weekEnd
    ).length;

    data.push({ date: dateStr, created: cumulativeCreated, resolved: cumulativeResolved });
  }

  return { projectId, weeks, data };
}

export async function getAverageAge(projectId: string) {
  const tasks = await Task.find({ projectId, status: { $ne: "done" } }).lean();
  const now = Date.now();

  const ages = (tasks as any[]).map((t: any) => {
    const created = new Date(t.createdAt).getTime();
    return Math.round((now - created) / (1000 * 60 * 60 * 24));
  });

  const avgAge =
    ages.length > 0 ? Math.round((ages.reduce((s: number, a: number) => s + a, 0) / ages.length) * 10) / 10 : 0;

  return {
    projectId,
    avgAge,
    maxAge: ages.length > 0 ? Math.max(...ages) : 0,
    minAge: ages.length > 0 ? Math.min(...ages) : 0,
    openTasks: tasks.length,
    ageDistribution: {
      "0-7": (tasks as any[]).filter((t: any) => daysSince(t.createdAt) <= 7).length,
      "8-30": (tasks as any[]).filter((t: any) => daysSince(t.createdAt) > 7 && daysSince(t.createdAt) <= 30).length,
      "31-90": (tasks as any[]).filter((t: any) => daysSince(t.createdAt) > 30 && daysSince(t.createdAt) <= 90).length,
      "90+": (tasks as any[]).filter((t: any) => daysSince(t.createdAt) > 90).length,
    },
  };
}

export async function getTimeToResolution(projectId: string) {
  const tasks = await Task.find({ projectId, status: "done" }).lean();

  const resolutionTimes = (tasks as any[]).map((t: any) => {
    const created = new Date(t.createdAt).getTime();
    const done = new Date(t.updatedAt).getTime();
    return Math.round((done - created) / (1000 * 60 * 60 * 24));
  });

  const avg =
    resolutionTimes.length > 0
      ? Math.round((resolutionTimes.reduce((s: number, r: number) => s + r, 0) / resolutionTimes.length) * 10) / 10
      : 0;

  return {
    projectId,
    avgTimeToResolution: avg,
    byType: {
      task: getAvgForType(tasks, "task"),
      bug: getAvgForType(tasks, "bug"),
      story: getAvgForType(tasks, "story"),
      epic: getAvgForType(tasks, "epic"),
      subtask: getAvgForType(tasks, "subtask"),
    },
  };
}

function daysSince(date: string | Date): number {
  return Math.round((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function getAvgForType(tasks: any[], type: string): number {
  const filtered = tasks.filter((t: any) => t.type === type);
  if (filtered.length === 0) return 0;
  const total = filtered.reduce((s: number, t: any) => {
    const created = new Date(t.createdAt).getTime();
    const done = new Date(t.updatedAt).getTime();
    return s + (done - created);
  }, 0);
  return Math.round(total / filtered.length / (1000 * 60 * 60 * 24) * 10) / 10;
}
