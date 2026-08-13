import { Router } from "express";
import multer from "multer";
import * as workspaceController from "../controllers/workspace";
import * as invitationController from "../controllers/invitation";
import * as customFieldController from "../controllers/customField";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
router.post(
  "/:workspaceId/avatar",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  upload.single("avatar"),
  workspaceController.uploadAvatar
);
router.delete(
  "/:workspaceId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  workspaceController.remove
);
router.post(
  "/:workspaceId/transfer",
  requireWorkspaceMember,
  workspaceController.transferOwnership
);

router.get(
  "/:workspaceId/default-project",
  requireWorkspaceMember,
  workspaceController.ensureDefaultProject
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
router.post(
  "/:workspaceId/invitations/resend/:invitationId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  invitationController.resend
);

router.get(
  "/:workspaceId/custom-fields",
  requireWorkspaceMember,
  customFieldController.list
);
router.post(
  "/:workspaceId/custom-fields",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  customFieldController.create
);
router.put(
  "/:workspaceId/custom-fields/:fieldId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  customFieldController.update
);
router.delete(
  "/:workspaceId/custom-fields/:fieldId",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  customFieldController.remove
);

export default router;
