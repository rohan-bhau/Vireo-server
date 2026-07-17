import { Router } from "express";
import * as workflowController from "../controllers/workflow";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/project/:projectId", requireWorkspaceMember, workflowController.getByProject);
router.get("/workspace/:workspaceId", requireWorkspaceMember, workflowController.getByWorkspace);
router.get("/project/:projectId/default", requireWorkspaceMember, workflowController.getDefault);
router.get("/:id", workflowController.getById);

router.post("/", workflowController.create);
router.post("/seed", requireWorkspaceMember, workflowController.seed);

router.put("/:id", workflowController.update);

router.delete("/:id", workflowController.remove);

export default router;
