import mongoose, { Schema } from "mongoose";

export interface IProjectRoleMember {
  userId: string;
  addedBy: string;
  addedAt: Date;
}

export interface IProjectRole {
  name: string;
  description?: string;
  projectId: string;
  workspaceId: string;
  isSystem: boolean;
  members: IProjectRoleMember[];
  createdBy: string;
}

const projectRoleMemberSchema = new Schema<IProjectRoleMember>(
  {
    userId: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectRoleSchema = new Schema<IProjectRole>(
  {
    name: { type: String, required: true },
    description: String,
    projectId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    isSystem: { type: Boolean, default: false },
    members: { type: [projectRoleMemberSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

projectRoleSchema.index({ projectId: 1 });
projectRoleSchema.index({ workspaceId: 1 });
projectRoleSchema.index({ projectId: 1, name: 1 }, { unique: true });

const ProjectRole = mongoose.model<IProjectRole>("ProjectRole", projectRoleSchema);

export default ProjectRole;
