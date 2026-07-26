import { Router } from "express";
import * as workflowSchemeController from "../controllers/workflowScheme";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/project/:projectId", requireWorkspaceMember, workflowSchemeController.getByProject);
router.get("/:id", workflowSchemeController.getById);
router.post("/", workflowSchemeController.create);
router.put("/:id", workflowSchemeController.update);
router.delete("/:id", workflowSchemeController.remove);

export default router;
