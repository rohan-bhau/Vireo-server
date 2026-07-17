import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as commentService from "../services/comment";

export async function getTaskComments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const comments = await commentService.getTaskComments(taskKey);
    res.status(200).json({ status: "success", data: { comments } });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const { content } = req.body;
    const comment = await commentService.createComment(taskKey, content, req.userId!);
    res.status(201).json({ status: "success", data: { comment } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const commentId = req.params.commentId as string;
    const { content } = req.body;
    const comment = await commentService.updateComment(commentId, content, req.userId!);
    res.status(200).json({ status: "success", data: { comment } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const commentId = req.params.commentId as string;
    await commentService.deleteComment(commentId, req.userId!);
    res.status(200).json({ status: "success", message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
}
