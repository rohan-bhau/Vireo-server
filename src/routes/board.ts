import { Router } from "express";
import * as boardController from "../controllers/board";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceRole } from "../middleware/workspace";
import { requireBoardMember } from "../middleware/board";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/:boardId", requireBoardMember, boardController.getById);
router.put("/:boardId", requireBoardMember, requireWorkspaceRole("ADMIN"), boardController.update);
router.delete("/:boardId", requireBoardMember, requireWorkspaceRole("ADMIN"), boardController.remove);

router.post("/:boardId/columns", requireBoardMember, requireWorkspaceRole("ADMIN"), boardController.addColumn);
router.put("/:boardId/columns/:columnId", requireBoardMember, requireWorkspaceRole("ADMIN"), boardController.updateColumn);
router.delete("/:boardId/columns/:columnId", requireBoardMember, requireWorkspaceRole("ADMIN"), boardController.removeColumn);
router.put("/:boardId/columns/reorder", requireBoardMember, requireWorkspaceRole("ADMIN"), boardController.reorderColumns);

export default router;
