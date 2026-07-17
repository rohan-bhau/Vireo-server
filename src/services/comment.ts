import Comment from "../models/mongoose/Comment";
import ActivityLog from "../models/mongoose/ActivityLog";
import { AppError } from "../utils/AppError";

export async function getTaskComments(taskKey: string) {
  return Comment.find({ taskId: taskKey }).sort({ createdAt: -1 });
}

export async function createComment(
  taskKey: string,
  content: string,
  authorId: string
) {
  const comment = await Comment.create({
    taskId: taskKey,
    authorId,
    content,
  });

  await ActivityLog.create({
    taskId: taskKey,
    actorId: authorId,
    action: "commented",
    field: "comment",
    newValue: content.substring(0, 100),
    timestamp: new Date(),
  });

  return comment;
}

export async function updateComment(
  commentId: string,
  content: string,
  userId: string
) {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new AppError("Comment not found", 404);
  if (comment.authorId !== userId) throw new AppError("Unauthorized", 403);

  comment.content = content;
  comment.editedAt = new Date();
  await comment.save();

  return comment;
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new AppError("Comment not found", 404);
  if (comment.authorId !== userId) throw new AppError("Unauthorized", 403);

  await Comment.findByIdAndDelete(commentId);
}
