import { Router } from "express";
import * as workspaceController from "../controllers/workspace";
import * as invitationController from "../controllers/invitation";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";

const router = Router();

router.use(authenticate);

router.get("/", workspaceController.getMyWorkspaces);
router.post("/", workspaceController.create);

router.get(
  "/:workspaceId",
  requireWorkspaceMember,
  workspaceController.getById
);
router.put(
  "/:workspaceId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  workspaceController.update
);
router.delete(
  "/:workspaceId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  workspaceController.remove
);

router.get(
  "/:workspaceId/members",
  requireWorkspaceMember,
  workspaceController.getMembers
);
router.delete(
  "/:workspaceId/members/:userId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  workspaceController.removeMember
);
router.put(
  "/:workspaceId/members/:userId/role",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  workspaceController.updateMemberRole
);

router.get(
  "/:workspaceId/invitations",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  invitationController.getWorkspaceInvitations
);
router.post(
  "/:workspaceId/invitations",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  invitationController.create
);
router.delete(
  "/:workspaceId/invitations/:invitationId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  invitationController.cancel
);

export default router;
