import { Router } from "express";
import { Response, NextFunction } from "express";
import { AuthRequest, authenticate } from "../middleware/auth";
import User from "../models/mongoose/User";

const router = Router();

router.use(authenticate);

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
