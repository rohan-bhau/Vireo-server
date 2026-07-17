import Task from "../models/mongoose/Task";
import AuditLog from "../models/mongoose/AuditLog";
import { prisma } from "../config/prisma";

export async function getDashboardStats(workspaceId: string) {
  const tasks = await Task.find({ workspaceId }).lean();
  const members = await prisma.workspaceMember.count({
    where: { workspaceId },
  });
  const projects = await prisma.project.count({
    where: { workspaceId },
  });

  const totalTasks = tasks.length;
  const todoTasks = tasks.filter((t) => t.status === "todo").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const inReviewTasks = tasks.filter((t) => t.status === "in_review").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const priorityCounts = {
    highest: tasks.filter((t) => t.priority === "highest").length,
    high: tasks.filter((t) => t.priority === "high").length,
    medium: tasks.filter((t) => t.priority === "medium").length,
    low: tasks.filter((t) => t.priority === "low").length,
    lowest: tasks.filter((t) => t.priority === "lowest").length,
  };

  const typeCounts = {
    task: tasks.filter((t) => t.type === "task").length,
    bug: tasks.filter((t) => t.type === "bug").length,
    epic: tasks.filter((t) => t.type === "epic").length,
    story: tasks.filter((t) => t.type === "story").length,
    subtask: tasks.filter((t) => t.type === "subtask").length,
  };

  const activeSprints = await prisma.sprint.findMany({
    where: {
      project: { workspaceId },
      status: "ACTIVE",
    },
  });

  const recentActivity = await AuditLog.find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return {
    taskStats: {
      total: totalTasks,
      byStatus: { todo: todoTasks, inProgress: inProgressTasks, inReview: inReviewTasks, done: doneTasks },
      byPriority: priorityCounts,
      byType: typeCounts,
    },
    memberCount: members,
    projectCount: projects,
    activeSprintCount: activeSprints.length,
    recentActivity,
  };
}

export async function getTaskTimeline(workspaceId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const tasks = await Task.find({
    workspaceId,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .lean();

  const timeline: Record<string, { created: number; done: number }> = {};
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setDate(date.getDate() + i);
    const key = date.toISOString().split("T")[0];
    timeline[key] = { created: 0, done: 0 };
  }

  for (const task of tasks) {
    const createdKey = new Date((task as unknown as Record<string, unknown>).createdAt as string).toISOString().split("T")[0];
    if (timeline[createdKey]) {
      timeline[createdKey].created += 1;
    }
    if (task.status === "done") {
      const updatedAt = (task as unknown as Record<string, unknown>).updatedAt as string;
      if (updatedAt) {
        const doneKey = new Date(updatedAt).toISOString().split("T")[0];
        if (timeline[doneKey]) {
          timeline[doneKey].done += 1;
        }
      }
    }
  }

  return Object.entries(timeline).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}

export async function getTeamWorkload(workspaceId: string) {
  const tasks = await Task.find({ workspaceId, status: { $ne: "done" } })
    .select("assignee priority status")
    .lean();

  const workloadMap: Record<string, { assigned: number; urgent: number; high: number; inProgress: number }> = {};

  for (const task of tasks) {
    const assignee = task.assignee || "unassigned";
    if (!workloadMap[assignee]) {
      workloadMap[assignee] = { assigned: 0, urgent: 0, high: 0, inProgress: 0 };
    }
    workloadMap[assignee].assigned += 1;
    if (task.priority === "highest") workloadMap[assignee].urgent += 1;
    if (task.priority === "high") workloadMap[assignee].high += 1;
    if (task.status === "in_progress" || task.status === "in_review") workloadMap[assignee].inProgress += 1;
  }

  return Object.entries(workloadMap).map(([userId, counts]) => ({
    userId,
    ...counts,
  }));
}
