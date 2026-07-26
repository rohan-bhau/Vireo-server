import PermissionScheme, { PERMISSIONS, type Permission } from "../models/mongoose/PermissionScheme";
import ProjectRole from "../models/mongoose/ProjectRole";
import IssueSecurityScheme from "../models/mongoose/IssueSecurityScheme";
import User from "../models/mongoose/User";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

const DEFAULT_ROLES = [
  { name: "Administrators", description: "Full project administration access", isSystem: true },
  { name: "Developers", description: "Can create, edit, and transition issues", isSystem: true },
  { name: "Viewers", description: "Read-only access to the project", isSystem: true },
];

const DEFAULT_SCHEME_MAPPINGS: Record<string, Permission[]> = {
  Administrators: [...PERMISSIONS],
  Developers: [
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
    "ADD_COMMENTS",
    "EDIT_OWN_COMMENTS",
    "DELETE_OWN_COMMENTS",
    "MANAGE_SPRINTS",
    "MANAGE_WATCHERS",
  ],
  Viewers: [
    "BROWSE_PROJECTS",
    "ADD_COMMENTS",
  ],
};

export async function ensureDefaultProjectRoles(projectId: string, workspaceId: string, createdBy: string) {
  for (const roleDef of DEFAULT_ROLES) {
    const exists = await ProjectRole.findOne({ projectId, name: roleDef.name });
    if (!exists) {
      await ProjectRole.create({
        ...roleDef,
        projectId,
        workspaceId,
        createdBy,
      });
    }
  }
}

export async function ensureDefaultPermissionScheme(workspaceId: string, createdBy: string) {
  const existing = await PermissionScheme.findOne({ workspaceId, isDefault: true });
  if (existing) return existing;

  const defaultRoles = await ProjectRole.find({
    workspaceId,
    name: { $in: ["Administrators", "Developers", "Viewers"] },
    isSystem: true,
  });

  if (defaultRoles.length < 3) {
    return null;
  }

  const roleMap = new Map(defaultRoles.map((r) => [r.name, r]));

  const mappings = Object.entries(DEFAULT_SCHEME_MAPPINGS).map(([roleName, permissions]) => {
    const role = roleMap.get(roleName);
    return {
      projectRoleId: role!._id.toString(),
      projectRoleName: roleName,
      permissions,
    };
  });

  return PermissionScheme.create({
    name: "Default Permission Scheme",
    description: "System default permission scheme",
    workspaceId,
    isDefault: true,
    mappings,
    createdBy,
  });
}

export async function getPermissionSchemes(workspaceId: string) {
  return PermissionScheme.find({ workspaceId }).sort({ createdAt: -1 });
}

export async function getPermissionSchemeById(id: string) {
  const scheme = await PermissionScheme.findById(id);
  if (!scheme) throw new AppError("Permission scheme not found", 404);
  return scheme;
}

export async function createPermissionScheme(data: {
  name: string;
  description?: string;
  workspaceId: string;
  mappings: { projectRoleId: string; projectRoleName: string; permissions: Permission[] }[];
  createdBy: string;
}) {
  const scheme = await PermissionScheme.create({
    ...data,
    isDefault: false,
  });
  return scheme;
}

export async function updatePermissionScheme(
  id: string,
  data: {
    name?: string;
    description?: string;
    mappings?: { projectRoleId: string; projectRoleName: string; permissions: Permission[] }[];
  }
) {
  const scheme = await PermissionScheme.findById(id);
  if (!scheme) throw new AppError("Permission scheme not found", 404);

  Object.assign(scheme, data);
  await scheme.save();
  return scheme;
}

export async function deletePermissionScheme(id: string) {
  const scheme = await PermissionScheme.findById(id);
  if (!scheme) throw new AppError("Permission scheme not found", 404);
  if (scheme.isDefault) throw new AppError("Cannot delete the default permission scheme", 400);
  await PermissionScheme.findByIdAndDelete(id);
}

export async function getProjectRoles(projectId: string) {
  return ProjectRole.find({ projectId }).sort({ isSystem: -1, name: 1 });
}

export async function getProjectRolesByWorkspace(workspaceId: string) {
  return ProjectRole.find({ workspaceId }).sort({ isSystem: -1, name: 1 });
}

export async function getProjectRoleById(id: string) {
  const role = await ProjectRole.findById(id);
  if (!role) throw new AppError("Project role not found", 404);
  return role;
}

export async function createProjectRole(data: {
  name: string;
  description?: string;
  projectId: string;
  workspaceId: string;
  createdBy: string;
}) {
  const existing = await ProjectRole.findOne({ projectId: data.projectId, name: data.name });
  if (existing) throw new AppError("A role with this name already exists in this project", 409);

  return ProjectRole.create({ ...data, isSystem: false, members: [] });
}

export async function updateProjectRole(
  id: string,
  data: { name?: string; description?: string }
) {
  const role = await ProjectRole.findById(id);
  if (!role) throw new AppError("Project role not found", 404);
  if (role.isSystem && data.name && data.name !== role.name) {
    throw new AppError("Cannot rename system roles", 400);
  }

  Object.assign(role, data);
  await role.save();
  return role;
}

export async function deleteProjectRole(id: string) {
  const role = await ProjectRole.findById(id);
  if (!role) throw new AppError("Project role not found", 404);
  if (role.isSystem) throw new AppError("Cannot delete system roles", 400);
  await ProjectRole.findByIdAndDelete(id);
}

export async function addMemberToProjectRole(roleId: string, userId: string, addedBy: string) {
  const role = await ProjectRole.findById(roleId);
  if (!role) throw new AppError("Project role not found", 404);

  const alreadyMember = role.members.some((m) => m.userId === userId);
  if (alreadyMember) throw new AppError("User is already a member of this role", 409);

  role.members.push({ userId, addedBy, addedAt: new Date() });
  await role.save();
  return role;
}

export async function removeMemberFromProjectRole(roleId: string, userId: string) {
  const role = await ProjectRole.findById(roleId);
  if (!role) throw new AppError("Project role not found", 404);

  role.members = role.members.filter((m) => m.userId !== userId);
  await role.save();
  return role;
}

export async function getIssueSecuritySchemes(workspaceId: string) {
  return IssueSecurityScheme.find({ workspaceId }).sort({ createdAt: -1 });
}

export async function getIssueSecuritySchemeById(id: string) {
  const scheme = await IssueSecurityScheme.findById(id);
  if (!scheme) throw new AppError("Issue security scheme not found", 404);
  return scheme;
}

export async function createIssueSecurityScheme(data: {
  name: string;
  description?: string;
  workspaceId: string;
  levels: { name: string; description?: string; members: { userId?: string; projectRoleId?: string }[] }[];
  createdBy: string;
}) {
  return IssueSecurityScheme.create({
    ...data,
    defaultLevelId: null,
  });
}

export async function updateIssueSecurityScheme(
  id: string,
  data: {
    name?: string;
    description?: string;
    levels?: { name: string; description?: string; members: { userId?: string; projectRoleId?: string }[] }[];
    defaultLevelId?: string | null;
  }
) {
  const scheme = await IssueSecurityScheme.findById(id);
  if (!scheme) throw new AppError("Issue security scheme not found", 404);

  Object.assign(scheme, data);
  await scheme.save();
  return scheme;
}

export async function deleteIssueSecurityScheme(id: string) {
  const scheme = await IssueSecurityScheme.findById(id);
  if (!scheme) throw new AppError("Issue security scheme not found", 404);
  await IssueSecurityScheme.findByIdAndDelete(id);
}

export async function getAllUsers(page = 1, limit = 20, search?: string) {
  const query: Record<string, any> = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select("-password -refreshToken")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return { users, total, page, totalPages: Math.ceil(total / limit) };
}

export async function updateUserRole(userId: string, role: "user" | "admin") {
  const user = await User.findByIdAndUpdate(userId, { role }, { new: true })
    .select("-password -refreshToken");
  if (!user) throw new AppError("User not found", 404);
  return user;
}

export async function assignPermissionSchemeToProject(projectId: string, permissionSchemeId: string) {
  const scheme = await PermissionScheme.findById(permissionSchemeId);
  if (!scheme) throw new AppError("Permission scheme not found", 404);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404);

  await prisma.project.update({
    where: { id: projectId },
    data: { permissionSchemeId },
  });

  return { ...project, permissionSchemeId };
}

export async function checkProjectPermission(
  userId: string,
  projectId: string,
  ...permissions: Permission[]
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true, permissionSchemeId: true },
  });
  if (!project) throw new AppError("Project not found", 404);

  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: project.workspaceId, userId },
    },
  });
  if (!workspaceMember) throw new AppError("Not a workspace member", 403);
  if (workspaceMember.role === "ADMIN") return true;

  const projectRoles = await ProjectRole.find({
    projectId,
    "members.userId": userId,
  });
  if (projectRoles.length === 0) return false;

  const schemeId = project.permissionSchemeId;
  const scheme = schemeId
    ? await PermissionScheme.findById(schemeId)
    : await PermissionScheme.findOne({ workspaceId: project.workspaceId, isDefault: true });
  if (!scheme) return false;

  const userRoleNames = new Set(projectRoles.map((r) => r.name));
  const granted = new Set<string>();
  for (const m of scheme.mappings) {
    if (userRoleNames.has(m.projectRoleName)) {
      for (const p of m.permissions) granted.add(p);
    }
  }

  return permissions.every((p) => granted.has(p));
}

export async function checkIssueSecurityAccess(userId: string, task: any): Promise<boolean> {
  if (!task.securityLevel) return true;

  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: task.workspaceId, userId },
    },
  });
  if (workspaceMember?.role === "ADMIN") return true;

  const scheme = await IssueSecurityScheme.findById(task.securityLevel);
  if (!scheme) return true;

  const level = scheme.levels.find((l) => {
    const levelId = (l as any)._id?.toString();
    return levelId === task.securityLevel;
  });
  if (!level) return true;

  return level.members.some((m) => m.userId === userId);
}

export async function getWorkspaceMembersForAdmin(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { workspace: true },
  });
}
