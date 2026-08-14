import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import * as commentService from "../services/comment";

async function emitCommentEvent(
  event: string,
  taskKey: string,
  comment: unknown,
  actorId: string
) {
  const io = getIO();
  if (!io) return;
  const Task = (await import("../models/mongoose/Task")).default;
  const task = await Task.findOne({ taskKey }).select("boardId workspaceId");
  if (!task) return;
  const data = { taskKey, comment, actorId };
  if (task.boardId) io.to(`board:${task.boardId}`).emit(event, data);
  if (task.workspaceId) io.to(`workspace:${task.workspaceId}`).emit(event, data);
}

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
    await emitCommentEvent("comment-created", taskKey, comment, req.userId!);
    res.status(201).json({ status: "success", data: { comment } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const commentId = req.params.commentId as string;
    const { content } = req.body;
    const comment = await commentService.updateComment(commentId, content, req.userId!);
    await emitCommentEvent("comment-updated", taskKey, comment, req.userId!);
    res.status(200).json({ status: "success", data: { comment } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const commentId = req.params.commentId as string;
    await commentService.deleteComment(commentId, req.userId!);
    await emitCommentEvent("comment-deleted", taskKey, { _id: commentId }, req.userId!);
    res.status(200).json({ status: "success", message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
}