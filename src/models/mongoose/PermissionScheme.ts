import mongoose, { Schema } from "mongoose";

export const PERMISSIONS = [
  "BROWSE_PROJECTS",
  "CREATE_ISSUES",
  "EDIT_ISSUES",
  "SCHEDULE_ISSUES",
  "MOVE_ISSUES",
  "ASSIGN_ISSUES",
  "ASSIGN_ISSUES_TO_SELF",
  "RESOLVE_ISSUES",
  "CLOSE_ISSUES",
  "DELETE_ISSUES",
  "CREATE_ATTACHMENTS",
  "DELETE_OWN_ATTACHMENTS",
  "DELETE_ALL_ATTACHMENTS",
  "ADD_COMMENTS",
  "EDIT_OWN_COMMENTS",
  "EDIT_ALL_COMMENTS",
  "DELETE_OWN_COMMENTS",
  "DELETE_ALL_COMMENTS",
  "MANAGE_SPRINTS",
  "MANAGE_WATCHERS",
  "MANAGE_PROJECT",
  "ADMINISTER_PROJECT",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface IPermissionMapping {
  projectRoleId: string;
  projectRoleName: string;
  permissions: Permission[];
}

export interface IPermissionScheme {
  name: string;
  description?: string;
  workspaceId: string;
  isDefault: boolean;
  mappings: IPermissionMapping[];
  createdBy: string;
}

const permissionMappingSchema = new Schema<IPermissionMapping>(
  {
    projectRoleId: { type: String, required: true },
    projectRoleName: { type: String, required: true },
    permissions: { type: [String], default: [] },
  },
  { _id: false }
);

const permissionSchemeSchema = new Schema<IPermissionScheme>(
  {
    name: { type: String, required: true },
    description: String,
    workspaceId: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    mappings: { type: [permissionMappingSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

permissionSchemeSchema.index({ workspaceId: 1 });
permissionSchemeSchema.index({ isDefault: 1 });

const PermissionScheme = mongoose.model<IPermissionScheme>("PermissionScheme", permissionSchemeSchema);

export default PermissionScheme;
