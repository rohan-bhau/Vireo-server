import { Router } from "express";
import * as automationController from "../controllers/automation";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/workspace/:workspaceId", requireWorkspaceMember, automationController.getByWorkspace);
router.get("/project/:projectId", requireWorkspaceMember, automationController.getByProject);
router.get("/:id", automationController.getById);

router.post("/", automationController.create);

router.put("/:id", automationController.update);
router.put("/:id/toggle", automationController.toggle);

router.delete("/:id", automationController.remove);

export default router;
