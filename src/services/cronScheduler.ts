import * as cron from "node-cron";
import { getScheduledRules, evaluateTriggers } from "./automation";

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

  console.log(`[CronScheduler] Initialized ${scheduledJobs.size} scheduled rules`);
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
