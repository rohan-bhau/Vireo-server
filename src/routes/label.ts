import { Router } from "express";
import * as labelController from "../controllers/label";
import { authenticate } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/project/:projectId", labelController.getProjectLabels);
router.get("/suggest", labelController.suggestLabels);
router.get("/workspace/:workspaceId", labelController.getWorkspaceLabels);
router.post("/project/:projectId/merge", labelController.mergeLabels);

export default router;
