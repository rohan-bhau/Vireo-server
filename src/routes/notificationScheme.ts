import { Router } from "express";
import * as notificationSchemeController from "../controllers/notificationScheme";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/workspace/:workspaceId", requireWorkspaceMember, notificationSchemeController.list);
router.get("/:id", notificationSchemeController.getById);
router.post("/", notificationSchemeController.create);
router.put("/:id", notificationSchemeController.update);
router.delete("/:id", notificationSchemeController.remove);

export default router;
