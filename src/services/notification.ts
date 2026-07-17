import Notification, { NotificationType, INotification } from "../models/mongoose/Notification";
import User from "../models/mongoose/User";

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  taskId: string;
  taskTitle: string;
  actorId: string;
  message: string;
}) {
  const actor = await User.findById(data.actorId);
  const actorName = actor?.name || "Someone";

  return Notification.create({
    ...data,
    actorName,
  });
}

export async function getUserNotifications(userId: string): Promise<INotification[]> {
  return Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
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

export async function notifyAssigned(taskId: string, taskTitle: string, assigneeId: string, actorId: string) {
  if (assigneeId === actorId) return;
  await createNotification({
    userId: assigneeId,
    type: "assigned",
    taskId,
    taskTitle,
    actorId,
    message: `assigned you to ${taskId}`,
  });
}

export async function notifyStatusChanged(taskId: string, taskTitle: string, newStatus: string, assigneeId: string | null | undefined, actorId: string) {
  if (!assigneeId || assigneeId === actorId) return;
  await createNotification({
    userId: assigneeId,
    type: "status_changed",
    taskId,
    taskTitle,
    actorId,
    message: `changed status of ${taskId} to ${newStatus.replace("_", " ")}`,
  });
}

export async function notifyMentioned(
  taskId: string,
  taskTitle: string,
  content: string,
  actorId: string
) {
  const mentionPattern = /@(\w+)/g;
  const matches = content.matchAll(mentionPattern);
  const mentionedNames = new Set<string>();
  for (const match of matches) {
    mentionedNames.add(match[1].toLowerCase());
  }
  if (mentionedNames.size === 0) return;

  const allUsers = await User.find({});
  for (const user of allUsers) {
    const nameLower = user.name.toLowerCase();
    const matched = Array.from(mentionedNames).some((n) => nameLower.startsWith(n) || nameLower.includes(n));
    if (matched && user._id.toString() !== actorId) {
      await createNotification({
        userId: user._id.toString(),
        type: "mentioned",
        taskId,
        taskTitle,
        actorId,
        message: `mentioned you in ${taskId}`,
      });
    }
  }
}
