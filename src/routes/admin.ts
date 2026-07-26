import { Router } from "express";
import * as permissionController from "../controllers/permission";
import * as groupController from "../controllers/group";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";
import { requireSiteAdmin } from "../middleware/permission";

const router = Router();

router.use(authenticate);

router.get("/overview", requireSiteAdmin, permissionController.getAdminOverview);

router.get("/users", requireSiteAdmin, permissionController.getAllUsers);
router.put("/users/:userId/role", requireSiteAdmin, permissionController.updateUserRole);

router.get(
  "/workspaces/:workspaceId/permission-schemes",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  permissionController.getPermissionSchemes
);
router.post(
  "/workspaces/:workspaceId/permission-schemes",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  permissionController.createPermissionScheme
);
router.get(
  "/permission-schemes/:id",
  requireSiteAdmin,
  permissionController.getPermissionScheme
);
router.put(
  "/permission-schemes/:id",
  requireSiteAdmin,
  permissionController.updatePermissionScheme
);
router.delete(
  "/permission-schemes/:id",
  requireSiteAdmin,
  permissionController.deletePermissionScheme
);

router.get(
  "/projects/:projectId/roles",
  requireWorkspaceMember,
  permissionController.getProjectRoles
);
router.post(
  "/projects/:projectId/roles",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  permissionController.createProjectRole
);
router.put(
  "/project-roles/:id",
  requireSiteAdmin,
  permissionController.updateProjectRole
);
router.delete(
  "/project-roles/:id",
  requireSiteAdmin,
  permissionController.deleteProjectRole
);
router.post(
  "/project-roles/:roleId/members",
  requireSiteAdmin,
  permissionController.addMemberToRole
);
router.delete(
  "/project-roles/:roleId/members/:userId",
  requireSiteAdmin,
  permissionController.removeMemberFromRole
);

router.get(
  "/workspaces/:workspaceId/issue-security-schemes",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  permissionController.getIssueSecuritySchemes
);
router.post(
  "/workspaces/:workspaceId/issue-security-schemes",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  permissionController.createIssueSecurityScheme
);
router.get(
  "/issue-security-schemes/:id",
  requireSiteAdmin,
  permissionController.getIssueSecurityScheme
);
router.put(
  "/issue-security-schemes/:id",
  requireSiteAdmin,
  permissionController.updateIssueSecurityScheme
);
router.delete(
  "/issue-security-schemes/:id",
  requireSiteAdmin,
  permissionController.deleteIssueSecurityScheme
);

router.put(
  "/projects/:projectId/permission-scheme",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  permissionController.assignPermissionScheme
);

router.get("/groups", requireSiteAdmin, groupController.getAllGroups);
router.get(
  "/workspaces/:workspaceId/groups",
  requireWorkspaceMember,
  groupController.getGroups
);
router.post(
  "/workspaces/:workspaceId/groups",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  groupController.createGroup
);
router.put("/groups/:id", requireSiteAdmin, groupController.updateGroup);
router.delete("/groups/:id", requireSiteAdmin, groupController.deleteGroup);
router.post("/groups/:groupId/members", requireSiteAdmin, groupController.addMember);
router.delete("/groups/:groupId/members/:userId", requireSiteAdmin, groupController.removeMember);

export default router;
