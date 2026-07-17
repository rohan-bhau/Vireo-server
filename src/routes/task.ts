import { Router } from "express";
import * as taskController from "../controllers/task";
import * as commentController from "../controllers/comment";
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
router.get("/:taskKey/comments", commentController.getTaskComments);

router.post("/", taskController.create);
router.post("/:taskKey/link", taskController.link);
router.post("/:taskKey/move", taskController.move);
router.post("/:taskKey/attachments", taskController.addAttachment);
router.post("/:taskKey/comments", commentController.create);

router.put("/:taskKey", taskController.update);
router.put("/reorder", taskController.reorder);
router.put("/:taskKey/comments/:commentId", commentController.update);

router.delete("/:taskKey", taskController.remove);
router.delete("/:taskKey/attachments/:publicId", taskController.removeAttachment);
router.delete("/:taskKey/link/:linkedTaskKey", taskController.unlink);
router.delete("/:taskKey/comments/:commentId", commentController.remove);

export default router;
