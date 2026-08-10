import { Router } from "express";
import { Response, NextFunction } from "express";
import { AuthRequest, authenticate } from "../middleware/auth";
import User from "../models/mongoose/User";
import * as notificationPreferenceService from "../services/notificationPreference";
import * as notificationSchemeService from "../services/notificationScheme";

const router = Router();

router.use(authenticate);

router.get("/workspace/:workspaceId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const pref = await notificationPreferenceService.getPreference(req.userId!, workspaceId);
    let events: string[] = [];
    if (pref) {
      events = pref.events;
    } else {
      const scheme = await notificationSchemeService.getDefaultScheme(workspaceId);
      events = scheme.events.map((e) => e.event);
    }
    res.status(200).json({ status: "success", data: { events } });
  } catch (error) {
    next(error);
  }
});

router.put("/workspace/:workspaceId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const events: string[] = Array.isArray(req.body?.events) ? req.body.events : [];
    const pref = await notificationPreferenceService.setPreference(req.userId!, workspaceId, events);
    res.status(200).json({
      status: "success",
      data: { events: pref?.events || [] },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId!).select("notificationPreferences projectNotificationOverrides");
    res.status(200).json({
      status: "success",
      data: {
        preferences: user?.notificationPreferences || {},
        projectOverrides: user?.projectNotificationOverrides || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId!,
      { notificationPreferences: req.body },
      { new: true }
    ).select("notificationPreferences projectNotificationOverrides");

    res.status(200).json({
      status: "success",
      data: {
        preferences: user?.notificationPreferences || {},
        projectOverrides: user?.projectNotificationOverrides || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/project/:projectId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const overrides = req.body;

    const user = await User.findById(req.userId!);
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    let existing = user.projectNotificationOverrides?.find((o) => o.projectId === projectId);

    if (existing) {
      Object.assign(existing, overrides, { projectId });
    } else {
      if (!user.projectNotificationOverrides) user.projectNotificationOverrides = [];
      user.projectNotificationOverrides.push({ projectId, ...overrides });
    }

    await user.save();

    res.status(200).json({
      status: "success",
      data: { projectOverrides: user.projectNotificationOverrides },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/project/:projectId", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;

    const user = await User.findById(req.userId!);
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    user.projectNotificationOverrides = user.projectNotificationOverrides?.filter(
      (o) => o.projectId !== projectId
    ) || [];

    await user.save();

    res.status(200).json({
      status: "success",
      data: { projectOverrides: user.projectNotificationOverrides },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
