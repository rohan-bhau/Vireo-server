import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as notificationService from "../services/notification";

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const notifications = await notificationService.getUserNotifications(req.userId!);
    const unreadCount = await notificationService.getUnreadCount(req.userId!);
    res.status(200).json({
      status: "success",
      data: { notifications, unreadCount },
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
