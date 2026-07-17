import { Router } from "express";
import * as dashboardController from "../controllers/dashboard";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router();

router.use(authenticate);

router.get(
  "/:workspaceId/stats",
  requireWorkspaceMember,
  dashboardController.getStats
);
router.get(
  "/:workspaceId/timeline",
  requireWorkspaceMember,
  dashboardController.getTimeline
);
router.get(
  "/:workspaceId/workload",
  requireWorkspaceMember,
  dashboardController.getWorkload
);

export default router;
