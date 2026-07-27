import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as notificationService from "../services/notification";

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type, projectId, read, limit, offset } = req.query;

    const result = await notificationService.getFilteredNotifications(req.userId!, {
      type: type as any || undefined,
      projectId: projectId as string || undefined,
      read: read !== undefined ? read === "true" : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    const unreadCount = await notificationService.getUnreadCount(req.userId!);

    res.status(200).json({
      status: "success",
      data: {
        notifications: result.notifications,
        total: result.total,
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await notificationService.markAsRead(req.params.id as string, req.userId!);
    res.status(200).json({ status: "success" });
  } catch (error) {
    next(error);
  }
}

export async function markUnread(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await notificationService.markAsUnread(req.params.id as string, req.userId!);
    res.status(200).json({ status: "success" });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllAsRead(req.userId!);
    res.status(200).json({ status: "success" });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const count = await notificationService.getUnreadCount(req.userId!);
    res.status(200).json({ status: "success", data: { count } });
  } catch (error) {
    next(error);
  }
}
