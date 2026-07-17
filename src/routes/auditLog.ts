import { Router } from "express";
import * as auditLogController from "../controllers/auditLog";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router();

router.use(authenticate);

router.get(
  "/:workspaceId",
  requireWorkspaceMember,
  auditLogController.getAuditLogs
);
router.get(
  "/:workspaceId/entity-types",
  requireWorkspaceMember,
  auditLogController.getEntityTypes
);
router.get(
  "/:workspaceId/actions",
  requireWorkspaceMember,
  auditLogController.getActions
);
router.get("/entry/:id", auditLogController.getAuditLogById);

export default router;
