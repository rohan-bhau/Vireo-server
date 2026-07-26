import mongoose, { Schema } from "mongoose";

export interface ISecurityLevelMember {
  userId: string;
  projectRoleId?: string;
}

export interface ISecurityLevel {
  name: string;
  description?: string;
  members: ISecurityLevelMember[];
}

export interface IIssueSecurityScheme {
  name: string;
  description?: string;
  workspaceId: string;
  levels: ISecurityLevel[];
  defaultLevelId: string | null;
  createdBy: string;
}

const securityLevelMemberSchema = new Schema<ISecurityLevelMember>(
  {
    userId: { type: String },
    projectRoleId: { type: String },
  },
  { _id: false }
);

const securityLevelSchema = new Schema<ISecurityLevel>(
  {
    name: { type: String, required: true },
    description: String,
    members: { type: [securityLevelMemberSchema], default: [] },
  },
  { _id: false }
);

const issueSecuritySchemeSchema = new Schema<IIssueSecurityScheme>(
  {
    name: { type: String, required: true },
    description: String,
    workspaceId: { type: String, required: true },
    levels: { type: [securityLevelSchema], default: [] },
    defaultLevelId: { type: String, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

issueSecuritySchemeSchema.index({ workspaceId: 1 });

const IssueSecurityScheme = mongoose.model<IIssueSecurityScheme>("IssueSecurityScheme", issueSecuritySchemeSchema);

export default IssueSecurityScheme;
