import Notification, { NotificationType, INotification } from "../models/mongoose/Notification";
import User from "../models/mongoose/User";
import Task from "../models/mongoose/Task";
import * as notificationSchemeService from "./notificationScheme";
import { sendNotificationEmail } from "./email";
import { getIO } from "../socket";
import { prisma } from "../config/prisma";

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  taskId?: string;
  taskTitle?: string;
  actorId: string;
  message: string;
  projectId?: string;
  workspaceId?: string;
}) {
  const actor = await User.findById(data.actorId);
  const actorName = actor?.name || "Someone";

  const notification = await Notification.create({
    ...data,
    actorName,
  });

  const io = getIO();
  if (io) {
    io.to(`user:${data.userId}`).emit("new-notification", notification.toObject());
    io.to(`user:${data.userId}`).emit("notification-count", { count: await getUnreadCount(data.userId) });
  }

  return notification;
}

export async function getUserNotifications(
  userId: string,
  filters?: { type?: NotificationType; projectId?: string; read?: boolean }
): Promise<INotification[]> {
  const query: any = { userId };
  if (filters?.type) query.type = filters.type;
  if (filters?.projectId) query.projectId = filters.projectId;
  if (filters?.read !== undefined) query.read = filters.read;
  return Notification.find(query).sort({ createdAt: -1 }).limit(100);
}

export async function getFilteredNotifications(
  userId: string,
  options: {
    type?: NotificationType;
    projectId?: string;
    read?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ notifications: INotification[]; total: number }> {
  const query: any = { userId };
  if (options.type) query.type = options.type;
  if (options.projectId) query.projectId = options.projectId;
  if (options.read !== undefined) query.read = options.read;

  const total = await Notification.countDocuments(query);
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(options.offset || 0)
    .limit(options.limit || 50);

  return { notifications, total };
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );
  return notification;
}

export async function markAsUnread(notificationId: string, userId: string) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: false },
    { new: true }
  );
  return notification;
}

export async function markAllAsRead(userId: string) {
  await Notification.updateMany({ userId, read: false }, { read: true });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, read: false });
}

async function dispatchNotification(
  userId: string,
  type: NotificationType,
  taskId: string | undefined,
  taskTitle: string | undefined,
  actorId: string,
  message: string,
  options?: { projectId?: string; workspaceId?: string; sendEmail?: boolean; actorName?: string }
) {
  if (userId === actorId) return;

  await createNotification({
    userId,
    type,
    taskId,
    taskTitle,
    actorId,
    message,
    projectId: options?.projectId,
    workspaceId: options?.workspaceId,
  });

  if (options?.sendEmail) {
    const user = await User.findById(userId);
    if (user && user.notificationPreferences?.email !== false) {
      await sendNotificationEmail(user.email, user.name, {
        type,
        actorName: options?.actorName || "",
        taskId,
        taskTitle,
        message,
        workspaceId: options.workspaceId || "",
      }).catch(() => {});
    }
  }
}

export async function notifyAssigned(
  taskId: string,
  taskTitle: string,
  assigneeId: string,
  actorId: string,
  options?: { projectId?: string; workspaceId?: string; schemeId?: string }
) {
  if (assigneeId === actorId) return;
  await dispatchNotification(
    assigneeId,
    "assigned",
    taskId,
    taskTitle,
    actorId,
    `assigned you to ${taskId}`,
    { ...options, sendEmail: true }
  );
}

export async function notifyStatusChanged(
  taskId: string,
  taskTitle: string,
  newStatus: string,
  assigneeId: string | null | undefined,
  actorId: string,
  options?: { projectId?: string; workspaceId?: string; schemeId?: string }
) {
  if (!assigneeId || assigneeId === actorId) return;
  await dispatchNotification(
    assigneeId,
    "status_changed",
    taskId,
    taskTitle,
    actorId,
    `changed status of ${taskId} to ${newStatus.replace("_", " ")}`,
    options
  );
}

export async function notifyMentioned(
  taskId: string,
  taskTitle: string,
  content: string,
  actorId: string,
  options?: { projectId?: string; workspaceId?: string }
) {
  if (!options?.workspaceId) return;

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: options.workspaceId },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((m) => m.userId));
  const users = await User.find({ _id: { $in: Array.from(memberIds) } });

  for (const user of users) {
    if (user._id.toString() === actorId) continue;
    const name = user.name;
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\s)@${escaped}(?=\\s|$|[.,!?;:])`, "i");
    if (!pattern.test(content)) continue;

    await dispatchNotification(
      user._id.toString(),
      "mentioned",
      taskId,
      taskTitle,
      actorId,
      `mentioned you in ${taskId}`,
      { ...options, sendEmail: true }
    );
  }
}

export async function notifyIssueCreated(
  taskId: string,
  taskTitle: string,
  actorId: string,
  workspaceId: string,
  projectId: string,
  reporter: string
) {
  const scheme = await notificationSchemeService.getDefaultScheme(workspaceId);
  const recipients = notificationSchemeService.getRecipientsForEvent(scheme, "issue_created", {
    reporter,
  });

  for (const userId of recipients.userIds) {
    await dispatchNotification(
      userId,
      "issue_created",
      taskId,
      taskTitle,
      actorId,
      `created ${taskId}`,
      { projectId, workspaceId, sendEmail: recipients.sendEmail }
    );
  }
}

export async function notifyIssueUpdated(
  taskId: string,
  taskTitle: string,
  actorId: string,
  workspaceId: string,
  projectId: string,
  assignee?: string | null,
  reporter?: string,
  watchers?: string[]
) {
  const scheme = await notificationSchemeService.getDefaultScheme(workspaceId);
  const recipients = notificationSchemeService.getRecipientsForEvent(scheme, "issue_updated", {
    assignee,
    reporter,
    watchers,
  });

  for (const userId of recipients.userIds) {
    await dispatchNotification(
      userId,
      "issue_updated",
      taskId,
      taskTitle,
      actorId,
      `updated ${taskId}`,
      { projectId, workspaceId, sendEmail: recipients.sendEmail }
    );
  }
}

export async function notifyIssueCommented(
  taskId: string,
  taskTitle: string,
  actorId: string,
  workspaceId: string,
  projectId: string,
  assignee?: string | null,
  reporter?: string,
  watchers?: string[]
) {
  const scheme = await notificationSchemeService.getDefaultScheme(workspaceId);
  const recipients = notificationSchemeService.getRecipientsForEvent(scheme, "issue_commented", {
    assignee,
    reporter,
    watchers,
  });

  for (const userId of recipients.userIds) {
    await dispatchNotification(
      userId,
      "commented",
      taskId,
      taskTitle,
      actorId,
      `commented on ${taskId}`,
      { projectId, workspaceId, sendEmail: recipients.sendEmail }
    );
  }
}

export async function notifyIssueDeleted(
  taskId: string,
  taskTitle: string,
  actorId: string,
  workspaceId: string,
  projectId: string,
  reporter?: string
) {
  const scheme = await notificationSchemeService.getDefaultScheme(workspaceId);
  const recipients = notificationSchemeService.getRecipientsForEvent(scheme, "issue_deleted", {
    reporter,
  });

  for (const userId of recipients.userIds) {
    await dispatchNotification(
      userId,
      "issue_deleted",
      taskId,
      taskTitle,
      actorId,
      `deleted ${taskId}`,
      { projectId, workspaceId, sendEmail: recipients.sendEmail }
    );
  }
}

export async function notifyMemberAdded(
  targetUserId: string,
  actorId: string,
  workspaceId: string,
  workspaceName: string
) {
  await dispatchNotification(
    targetUserId,
    "member_added",
    undefined,
    workspaceName,
    actorId,
    `added you to the ${workspaceName} workspace`,
    { workspaceId, sendEmail: true }
  );
}

export async function notifyRoleChanged(
  targetUserId: string,
  actorId: string,
  workspaceId: string,
  newRole: string
) {
  await dispatchNotification(
    targetUserId,
    "role_changed",
    undefined,
    newRole,
    actorId,
    `set your workspace role to ${newRole}`,
    { workspaceId, sendEmail: true }
  );
}

export async function notifyDueDate(
  targetUserId: string,
  taskId: string,
  taskTitle: string,
  workspaceId: string | undefined,
  projectId: string | undefined,
  daysLeft: number
) {
  await dispatchNotification(
    targetUserId,
    "due_date",
    taskId,
    taskTitle,
    "system",
    `${taskId} is due ${daysLeft <= 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}`,
    { projectId, workspaceId, sendEmail: true }
  );
}

export async function notifyIssueCompleted(
  targetUserId: string,
  taskId: string,
  taskTitle: string,
  actorId: string,
  workspaceId?: string,
  projectId?: string
) {
  await dispatchNotification(
    targetUserId,
    "issue_completed",
    taskId,
    taskTitle,
    actorId,
    `completed ${taskId}`,
    { projectId, workspaceId, sendEmail: true }
  );
}
