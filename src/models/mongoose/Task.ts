import mongoose, { Document, Schema } from "mongoose";

export type TaskType = "task" | "bug" | "epic" | "story" | "subtask";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "lowest" | "low" | "medium" | "high" | "highest";

export interface ITask {
  taskKey: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string | null;
  reporter: string;
  projectId: string;
  boardId?: string | null;
  columnId?: string | null;
  position: number;
  labels: string[];
  dueDate?: Date | null;
  storyPoints?: number | null;
  parentTask?: string | null;
  linkedTasks: { taskId: string; type: "blocks" | "blocked_by" | "relates_to" }[];
  attachments: { url: string; filename: string; publicId: string }[];
  workspaceId: string;
  sprintId?: string | null;
}

const taskSchema = new Schema<ITask>(
  {
    taskKey: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [1, "Title must be at least 1 character"],
      maxlength: [500, "Title must be at most 500 characters"],
    },
    description: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["task", "bug", "epic", "story", "subtask"],
      default: "task",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "in_review", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["lowest", "low", "medium", "high", "highest"],
      default: "medium",
    },
    assignee: {
      type: String,
      default: null,
    },
    reporter: {
      type: String,
      required: true,
    },
    projectId: {
      type: String,
      required: true,
    },
    boardId: {
      type: String,
      default: null,
    },
    columnId: {
      type: String,
      default: null,
    },
    position: {
      type: Number,
      default: 0,
    },
    labels: {
      type: [String],
      default: [],
    },
    dueDate: {
      type: Date,
      default: null,
    },
    storyPoints: {
      type: Number,
      default: null,
    },
    parentTask: {
      type: String,
      default: null,
    },
    linkedTasks: {
      type: [
        {
          taskId: { type: String, required: true },
          type: { type: String, enum: ["blocks", "blocked_by", "relates_to"], required: true },
        },
      ],
      default: [],
    },
    attachments: {
      type: [
        {
          url: { type: String, required: true },
          filename: { type: String, required: true },
          publicId: { type: String, required: true },
        },
      ],
      default: [],
    },
    workspaceId: {
      type: String,
      required: true,
    },
    sprintId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

taskSchema.index({ taskKey: 1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ workspaceId: 1 });
taskSchema.index({ assignee: 1 });
taskSchema.index({ boardId: 1, columnId: 1, position: 1 });

const Task = mongoose.model<ITask>("Task", taskSchema);

export default Task;
