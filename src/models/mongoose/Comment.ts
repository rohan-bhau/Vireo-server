import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  taskId: string;
  authorId: string;
  content: string;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    taskId: {
      type: String,
      required: true,
      index: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

commentSchema.index({ taskId: 1, createdAt: -1 });

const Comment = mongoose.model<IComment>("Comment", commentSchema);

export default Comment;
