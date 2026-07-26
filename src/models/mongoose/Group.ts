import mongoose, { Schema } from "mongoose";

export interface IGroupMember {
  userId: string;
  addedAt: Date;
}

export interface IGroup {
  name: string;
  description?: string;
  workspaceId: string;
  members: IGroupMember[];
  createdBy: string;
}

const groupMemberSchema = new Schema<IGroupMember>(
  {
    userId: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    description: String,
    workspaceId: { type: String, required: true },
    members: { type: [groupMemberSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

groupSchema.index({ workspaceId: 1 });
groupSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

const Group = mongoose.model<IGroup>("Group", groupSchema);

export default Group;
