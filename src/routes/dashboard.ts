import { Router } from "express";
import * as dashboardController from "../controllers/dashboard";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router();

router.use(authenticate);

router.get("/:workspaceId/stats", requireWorkspaceMember, dashboardController.getStats);
router.get("/:workspaceId/timeline", requireWorkspaceMember, dashboardController.getTimeline);
router.get("/:workspaceId/workload", requireWorkspaceMember, dashboardController.getWorkload);
router.get("/:workspaceId/gadgets", requireWorkspaceMember, dashboardController.getGadgetData);
router.get("/:workspaceId", requireWorkspaceMember, dashboardController.listDashboards);
router.post("/:workspaceId", requireWorkspaceMember, dashboardController.createDashboard);
router.get("/:workspaceId/:dashboardId", requireWorkspaceMember, dashboardController.getDashboard);
router.put("/:workspaceId/:dashboardId", requireWorkspaceMember, dashboardController.updateDashboard);
router.delete("/:workspaceId/:dashboardId", requireWorkspaceMember, dashboardController.deleteDashboard);

export default router;
