import { Router } from "express";
import { Response, NextFunction } from "express";
import { AuthRequest, authenticate } from "../middleware/auth";
import Task from "../models/mongoose/Task";
import { AppError } from "../utils/AppError";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post("/:taskKey/watch", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await Task.findOne({ taskKey: req.params.taskKey });
    if (!task) throw new AppError("Task not found", 404);

    const userId = req.userId!;
    if (!task.watchers.includes(userId)) {
      task.watchers.push(userId);
      await task.save();
    }

    res.status(200).json({ status: "success", data: { watchers: task.watchers } });
  } catch (error) {
    next(error);
  }
});

router.post("/:taskKey/unwatch", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await Task.findOne({ taskKey: req.params.taskKey });
    if (!task) throw new AppError("Task not found", 404);

    task.watchers = task.watchers.filter((id) => id !== req.userId!);
    await task.save();

    res.status(200).json({ status: "success", data: { watchers: task.watchers } });
  } catch (error) {
    next(error);
  }
});

router.get("/:taskKey/watchers", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await Task.findOne({ taskKey: req.params.taskKey });
    if (!task) throw new AppError("Task not found", 404);

    const User = (await import("../models/mongoose/User")).default;
    const users = await User.find({ _id: { $in: task.watchers } }).select("name email avatar");

    res.status(200).json({
      status: "success",
      data: { watchers: task.watchers, users },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:taskKey/watching", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await Task.findOne({ taskKey: req.params.taskKey });
    if (!task) throw new AppError("Task not found", 404);

    const isWatching = task.watchers.includes(req.userId!);

    res.status(200).json({
      status: "success",
      data: { isWatching },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
