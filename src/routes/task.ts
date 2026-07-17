import { Router } from "express";
import * as taskController from "../controllers/task";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/workspace/:workspaceId", requireWorkspaceMember, taskController.getByWorkspace);
router.get("/project/:projectId", taskController.getByProject);
router.get("/board/:boardId", taskController.getByBoard);
router.get("/column/:columnId", taskController.getByColumn);
router.get("/:taskKey", taskController.getByKey);
router.get("/:taskKey/activity", taskController.getActivity);

router.post("/", taskController.create);
router.post("/:taskKey/link", taskController.link);
router.post("/:taskKey/move", taskController.move);
router.post("/:taskKey/attachments", taskController.addAttachment);

router.put("/:taskKey", taskController.update);
router.put("/reorder", taskController.reorder);

router.delete("/:taskKey", taskController.remove);
router.delete("/:taskKey/attachments/:publicId", taskController.removeAttachment);
router.delete("/:taskKey/link/:linkedTaskKey", taskController.unlink);

export default router;
