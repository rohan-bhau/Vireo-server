import { Router } from "express";
import * as savedFilterController from "../controllers/savedFilter";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/workspace/:workspaceId", requireWorkspaceMember, savedFilterController.getMyFilters);
router.get("/:id", savedFilterController.getById);

router.post("/", savedFilterController.create);

router.put("/:id", savedFilterController.update);

router.delete("/:id", savedFilterController.remove);

export default router;
