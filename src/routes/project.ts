import { Router } from "express";
import * as projectController from "../controllers/project";
import * as boardController from "../controllers/board";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/", requireWorkspaceMember, projectController.getByWorkspace);
router.post("/", requireWorkspaceMember, requireWorkspaceRole("ADMIN"), projectController.create);

router.get("/:projectId", requireWorkspaceMember, projectController.getById);
router.put("/:projectId", requireWorkspaceMember, requireWorkspaceRole("ADMIN"), projectController.update);
router.delete("/:projectId", requireWorkspaceMember, requireWorkspaceRole("ADMIN"), projectController.remove);

router.get("/:projectId/boards", requireWorkspaceMember, boardController.getByProject);
router.post("/:projectId/boards", requireWorkspaceMember, requireWorkspaceRole("ADMIN"), boardController.create);

export default router;
