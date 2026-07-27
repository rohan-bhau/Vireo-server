import Comment from "../models/mongoose/Comment";
import ActivityLog from "../models/mongoose/ActivityLog";
import Task from "../models/mongoose/Task";
import { AppError } from "../utils/AppError";
import { notifyMentioned, notifyIssueCommented } from "./notification";
import { checkProjectPermission, checkIssueSecurityAccess } from "./permission";

export async function getTaskComments(taskKey: string) {
  return Comment.find({ taskId: taskKey }).sort({ createdAt: -1 });
}

export async function createComment(
  taskKey: string,
  content: string,
  authorId: string
) {
  const task = await Task.findOne({ taskKey });
  if (!task) throw new AppError("Task not found", 404);

  const hasPerm = await checkProjectPermission(authorId, task.projectId, "ADD_COMMENTS");
  if (!hasPerm) throw new AppError("You do not have permission to comment in this project", 403);

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

  const foundTask = await Task.findOne({ taskKey });
  if (foundTask) {
    await notifyMentioned(taskKey, foundTask.title, content, authorId, {
      projectId: foundTask.projectId,
      workspaceId: foundTask.workspaceId,
    });
    await notifyIssueCommented(
      taskKey,
      foundTask.title,
      authorId,
      foundTask.workspaceId,
      foundTask.projectId,
      foundTask.assignee,
      foundTask.reporter,
      foundTask.watchers
    );
  }

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
