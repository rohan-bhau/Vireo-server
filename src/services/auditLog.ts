import AuditLog from "../models/mongoose/AuditLog";
import User from "../models/mongoose/User";

export async function recordAuditLog(data: {
  workspaceId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  const actor = await User.findById(data.actorId);
  return AuditLog.create({
    workspaceId: data.workspaceId,
    actorId: data.actorId,
    actorName: actor?.name || "Unknown",
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    entityName: data.entityName || "",
    details: data.details || {},
    ip: data.ip || "",
  });
}

export async function getWorkspaceAuditLogs(
  workspaceId: string,
  options: {
    limit?: number;
    offset?: number;
    entityType?: string;
    action?: string;
    actorId?: string;
  } = {}
) {
  const { limit = 50, offset = 0, entityType, action, actorId } = options;
  const filter: Record<string, unknown> = { workspaceId };
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;
  if (actorId) filter.actorId = actorId;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total, limit, offset };
}

export async function getAuditLogById(id: string) {
  return AuditLog.findById(id).lean();
}

export async function getAuditLogEntityTypes(workspaceId: string) {
  return AuditLog.distinct("entityType", { workspaceId });
}

export async function getAuditLogActions(workspaceId: string) {
  return AuditLog.distinct("action", { workspaceId });
}
