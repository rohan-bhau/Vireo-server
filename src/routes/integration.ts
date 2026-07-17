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

export default router;
