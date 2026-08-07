import * as cron from "node-cron";
import { getScheduledRules, evaluateTriggers } from "./automation";
import Task from "../models/mongoose/Task";
import { notifyDueDate } from "./notification";

const scheduledJobs = new Map<string, cron.ScheduledTask>();

export async function initCronScheduler() {
  const rules = await getScheduledRules();

  for (const rule of rules) {
    if (rule.cronExpression) {
      scheduleRule(rule._id.toString(), rule.cronExpression, {
        ruleName: rule.name,
        workspaceId: rule.workspaceId,
        projectId: rule.projectId || undefined,
      });
    }
  }

  scheduleDueDateReminders();

  console.log(`[CronScheduler] Initialized ${scheduledJobs.size} scheduled rules`);
}

function scheduleDueDateReminders() {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;

      const tasks = await Task.find({
        dueDate: { $ne: null },
        status: { $ne: "done" },
      }).lean();

      for (const task of tasks) {
        if (!task.dueDate) continue;
        const due = new Date(task.dueDate).getTime();
        const diff = due - now.getTime();
        if (diff < 0 || diff > dayMs) continue;

        const daysLeft = Math.ceil(diff / dayMs);
        const assignee = task.assignee;
        if (assignee) {
          await notifyDueDate(
            assignee,
            task.taskKey,
            task.title,
            task.workspaceId as string,
            task.projectId as string,
            daysLeft
          );
        }
      }
    } catch (error) {
      console.error("[CronScheduler] Due-date reminder sweep failed:", error);
    }
  });

  console.log("[CronScheduler] Due-date reminder sweep scheduled (hourly)");
}

export function scheduleRule(
  ruleId: string,
  cronExpression: string,
  context: { ruleName: string; workspaceId: string; projectId?: string }
) {
  if (scheduledJobs.has(ruleId)) {
    scheduledJobs.get(ruleId)!.stop();
  }

  if (!cron.validate(cronExpression)) {
    console.warn(`[CronScheduler] Invalid cron expression for rule "${context.ruleName}": ${cronExpression}`);
    return;
  }

  const job = cron.schedule(cronExpression, async () => {
    console.log(`[CronScheduler] Firing scheduled rule "${context.ruleName}"`);
    await evaluateTriggers("scheduled", {
      taskKey: "system",
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      actorId: "system",
    });
  });

  scheduledJobs.set(ruleId, job);
  console.log(`[CronScheduler] Scheduled rule "${context.ruleName}" with cron: ${cronExpression}`);
}

export function unscheduleRule(ruleId: string) {
  const job = scheduledJobs.get(ruleId);
  if (job) {
    job.stop();
    scheduledJobs.delete(ruleId);
  }
}

export async function refreshRuleSchedule(ruleId: string) {
  const AutomationRule = (await import("../models/mongoose/AutomationRule")).default;
  const rule = await AutomationRule.findById(ruleId);
  if (!rule) {
    unscheduleRule(ruleId);
    return;
  }

  if (!rule.enabled || rule.trigger !== "scheduled" || !rule.cronExpression) {
    unscheduleRule(ruleId);
    return;
  }

  scheduleRule(ruleId, rule.cronExpression, {
    ruleName: rule.name,
    workspaceId: rule.workspaceId,
    projectId: rule.projectId || undefined,
  });
}
