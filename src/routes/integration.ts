import { Router } from "express";
import * as integrationController from "../controllers/integration";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";

const router = Router();

router.use(authenticate);

router.get(
  "/:workspaceId",
  requireWorkspaceMember,
  integrationController.getIntegrations
);
router.get(
  "/:workspaceId/:type",
  requireWorkspaceMember,
  integrationController.getIntegration
);
router.put(
  "/:workspaceId/:type",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.createOrUpdate
);
router.delete(
  "/:workspaceId/:type",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.remove
);
router.patch(
  "/:workspaceId/:type/toggle",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.toggle
);
router.post(
  "/:workspaceId/:type/test",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.test
);

router.get(
  "/:workspaceId/webhook/logs",
  requireWorkspaceMember,
  integrationController.getWebhookLogs
);

router.get(
  "/:workspaceId/github/data",
  requireWorkspaceMember,
  integrationController.getGitHubData
);

router.post(
  "/:workspaceId/github/sync-branch",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.syncGitHubBranch
);

router.post(
  "/:workspaceId/slack/send",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.sendMessage
);

router.post(
  "/:workspaceId/slack/issue",
  requireWorkspaceMember,
  requireWorkspaceRole("MEMBER"),
  integrationController.createSlackIssue
);

router.get(
  "/:workspaceId/webhook",
  requireWorkspaceMember,
  integrationController.listWebhooks
);

router.post(
  "/:workspaceId/webhook",
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  integrationController.createWebhook
);

export default router;
