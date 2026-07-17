import Integration from "../models/mongoose/Integration";

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
