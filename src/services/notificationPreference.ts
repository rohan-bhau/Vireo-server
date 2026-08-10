import WorkspaceNotificationPreference from "../models/mongoose/WorkspaceNotificationPreference";

export async function getPreference(userId: string, workspaceId: string) {
  return WorkspaceNotificationPreference.findOne({ userId, workspaceId });
}

export async function isEventEnabled(
  userId: string,
  workspaceId: string | undefined,
  event: string | undefined
): Promise<boolean> {
  if (!workspaceId || !event) return true;
  const pref = await WorkspaceNotificationPreference.findOne({
    userId,
    workspaceId,
  }).select("events");
  if (!pref) return true;
  return pref.events.includes(event);
}

export async function setPreference(userId: string, workspaceId: string, events: string[]) {
  const uniqueEvents = [...new Set(events)];
  const pref = await WorkspaceNotificationPreference.findOneAndUpdate(
    { userId, workspaceId },
    { $set: { events: uniqueEvents } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return pref;
}