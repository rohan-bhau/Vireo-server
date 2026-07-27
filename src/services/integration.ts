import Integration from "../models/mongoose/Integration";
import WebhookLog from "../models/mongoose/WebhookLog";
import Task from "../models/mongoose/Task";
import { prisma } from "../config/prisma";

export async function getWorkspaceIntegrations(workspaceId: string) {
  return Integration.find({ workspaceId } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .lean();
}

export async function getIntegration(workspaceId: string, type: string) {
  return Integration.findOne({ workspaceId, type } as Record<string, unknown>).lean();
}

export async function createOrUpdateIntegration(data: {
  workspaceId: string;
  type: "slack" | "github";
  name: string;
  config: Record<string, unknown>;
  configuredBy: string;
  enabled?: boolean;
}) {
  const filter = { workspaceId: data.workspaceId, type: data.type } as Record<string, unknown>;
  const existing = await Integration.findOne(filter);
  if (existing) {
    existing.name = data.name;
    existing.config = data.config;
    existing.configuredBy = data.configuredBy;
    if (data.enabled !== undefined) existing.enabled = data.enabled;
    return existing.save();
  }
  return Integration.create(data as Record<string, unknown>);
}

export async function deleteIntegration(workspaceId: string, type: string) {
  return Integration.deleteOne({ workspaceId, type } as Record<string, unknown>);
}

export async function toggleIntegration(workspaceId: string, type: string, enabled: boolean) {
  return Integration.findOneAndUpdate(
    { workspaceId, type } as Record<string, unknown>,
    { enabled },
    { new: true }
  ).lean();
}

export async function testIntegration(workspaceId: string, type: string) {
  const integration = await Integration.findOne({ workspaceId, type } as Record<string, unknown>).lean();
  if (!integration) {
    throw new Error("Integration not found");
  }
  const success = await sendTestPayload(integration as unknown as Record<string, unknown>);
  const status = success ? "success" : "failure";
  await Integration.findOneAndUpdate(
    { workspaceId, type } as Record<string, unknown>,
    { lastTestedAt: new Date(), lastTestStatus: status }
  );
  return { success, status };
}

async function sendTestPayload(integration: Record<string, unknown>): Promise<boolean> {
  try {
    const config = integration.config as Record<string, unknown>;
    if (integration.type === "slack") {
      const webhookUrl = config.webhookUrl as string;
      if (!webhookUrl) return false;
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "✅ Vireo integration test successful!" }),
      });
      return response.ok;
    }
    if (integration.type === "github") {
      const token = config.token as string;
      const repo = config.repo as string;
      if (!token || !repo) return false;
      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      return response.ok;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function getGitHubConfig(workspaceId: string) {
  const integration = await Integration.findOne({ workspaceId, type: "github" }).lean();
  if (!integration) throw new Error("GitHub integration not configured");
  const config = integration.config as Record<string, string>;
  if (!config.token || !config.repo) throw new Error("GitHub integration incomplete");
  return config;
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

export async function syncGitHubIssue(workspaceId: string, issueKey: string, branchName: string) {
  const cfg = await getGitHubConfig(workspaceId);
  const task = await Task.findOne({ workspaceId, taskKey: issueKey }).lean();
  if (!task) throw new Error(`Issue ${issueKey} not found`);

  const refRes = await fetch(
    `https://api.github.com/repos/${cfg.repo}/git/ref/heads/main`,
    { headers: ghHeaders(cfg.token) }
  );
  if (!refRes.ok) throw new Error("Could not fetch base branch ref");
  const { object: { sha } } = await refRes.json() as { object: { sha: string } };

  const createRes = await fetch(
    `https://api.github.com/repos/${cfg.repo}/git/refs`,
    {
      method: "POST",
      headers: { ...ghHeaders(cfg.token), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    }
  );
  if (!createRes.ok) throw new Error("Could not create branch");

  return { branch: branchName, sha };
}

export async function getGitHubCommits(workspaceId: string, issueKey: string) {
  const cfg = await getGitHubConfig(workspaceId);
  const res = await fetch(
    `https://api.github.com/repos/${cfg.repo}/commits?sha=main`,
    { headers: ghHeaders(cfg.token) }
  );
  if (!res.ok) return [];
  const commits = await res.json() as Array<Record<string, unknown>>;
  return commits
    .filter((c: Record<string, unknown>) => {
      const msg = (c.commit as Record<string, unknown>).message as string;
      return msg.includes(issueKey);
    })
    .map((c: Record<string, unknown>) => ({
      sha: c.sha,
      message: (c.commit as Record<string, unknown>).message,
      author: (c.commit as Record<string, unknown>).author,
      url: c.html_url,
    }));
}

export async function getGitHubPRs(workspaceId: string, issueKey: string) {
  const cfg = await getGitHubConfig(workspaceId);
  const res = await fetch(
    `https://api.github.com/repos/${cfg.repo}/pulls?state=all&per_page=50`,
    { headers: ghHeaders(cfg.token) }
  );
  if (!res.ok) return [];
  const prs = await res.json() as Array<Record<string, unknown>>;
  return prs
    .filter((pr: Record<string, unknown>) => {
      const title = pr.title as string;
      const body = (pr.body as string) || "";
      return title.includes(issueKey) || body.includes(issueKey);
    })
    .map((pr: Record<string, unknown>) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      html_url: pr.html_url,
      user: pr.user,
      created_at: pr.created_at,
    }));
}

// ─── Slack helpers ────────────────────────────────────────────────────────────

export async function sendSlackMessage(workspaceId: string, channel: string, text: string) {
  const integration = await Integration.findOne({ workspaceId, type: "slack" }).lean();
  if (!integration) throw new Error("Slack integration not configured");
  const config = integration.config as Record<string, string>;
  const webhookUrl = config.webhookUrl;
  if (!webhookUrl) throw new Error("Slack webhook URL not configured");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text, mrkdwn: true }),
  });
  if (!res.ok) throw new Error("Slack message send failed");
  return { ok: true };
}

export async function createSlackIssue(workspaceId: string, channel: string, title: string) {
  const project = await prisma.project.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  if (!project) throw new Error("No project found in workspace");

  const task = await Task.create({
    taskKey: `TASK-${Date.now()}`,
    title,
    type: "task",
    status: "todo",
    priority: "medium",
    reporter: "slack-bot",
    workspaceId,
    projectId: project.id,
    position: 0,
    labels: [],
    components: [],
    linkedTasks: [],
    attachments: [],
    watchers: [],
  });
  await sendSlackMessage(workspaceId, channel, `✅ Created issue *${task.taskKey}*: ${title}`);
  return task;
}

// ─── Webhook helpers ───────────────────────────────────────────────────────────

export async function getWebhookIntegrations(workspaceId: string) {
  return Integration.find({ workspaceId, type: "webhook" } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .lean();
}

export async function createWebhookIntegration(
  workspaceId: string,
  config: Record<string, unknown>,
  configuredBy: string
) {
  const name = (config.name as string) || "Webhook";
  return Integration.create({
    workspaceId,
    type: "webhook",
    name,
    config,
    configuredBy,
    enabled: true,
  });
}

export async function testWebhook(url: string, payload: Record<string, unknown>) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const duration = Date.now() - start;
    const body = await res.text();
    return { status: res.status, duration, response: body.slice(0, 2000) };
  } catch (err: unknown) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { status: null, duration, response: message };
  }
}

export async function dispatchWebhook(workspaceId: string, event: string, payload: Record<string, unknown>) {
  const webhooks = await Integration.find({
    workspaceId,
    type: "webhook",
    enabled: true,
  } as Record<string, unknown>).lean();

  const results: Array<{ webhookId: string; status: number | null; duration: number }> = [];

  for (const wh of webhooks) {
    const cfg = wh.config as Record<string, unknown>;
    const url = cfg.url as string;
    if (!url) continue;

    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, ...payload }),
      });
      const duration = Date.now() - start;
      const body = await res.text();
      await WebhookLog.create({
        workspaceId,
        webhookId: wh._id.toString(),
        event,
        url,
        status: res.status,
        response: body.slice(0, 2000),
        duration,
      });
      results.push({ webhookId: wh._id.toString(), status: res.status, duration });
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      await WebhookLog.create({
        workspaceId,
        webhookId: wh._id.toString(),
        event,
        url,
        status: null,
        response: message,
        duration,
      });
      results.push({ webhookId: wh._id.toString(), status: null, duration });
    }
  }

  return results;
}

export async function getWebhookLogs(workspaceId: string, webhookId?: string, limit = 50) {
  const filter: Record<string, unknown> = { workspaceId };
  if (webhookId) filter.webhookId = webhookId;
  return WebhookLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}
