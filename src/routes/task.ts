import { Router } from "express";
import multer from "multer";
import * as taskController from "../controllers/task";
import * as commentController from "../controllers/comment";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";
import { checkIssueSecurity, requireTaskEditor, requireTaskStatusEditor } from "../middleware/permission";

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(authenticate);

router.get("/workspace/:workspaceId", requireWorkspaceMember, taskController.getByWorkspace);
router.get("/project/:projectId", taskController.getByProject);
router.get("/board/:boardId", taskController.getByBoard);
router.get("/column/:columnId", taskController.getByColumn);
router.get("/:taskKey", checkIssueSecurity, taskController.getByKey);
router.get("/:taskKey/activity", checkIssueSecurity, taskController.getActivity);
router.get("/:taskKey/subtasks", checkIssueSecurity, taskController.getSubtasks);
router.get("/:taskKey/comments", checkIssueSecurity, commentController.getTaskComments);

router.post("/", requireTaskEditor, taskController.create);
router.post("/:taskKey/link", checkIssueSecurity, requireTaskEditor, taskController.link);
router.post("/:taskKey/move", checkIssueSecurity, requireTaskStatusEditor, taskController.move);
router.post("/:taskKey/attachments", checkIssueSecurity, requireTaskEditor, taskController.addAttachment);
router.post("/:taskKey/attachments/upload", checkIssueSecurity, requireTaskEditor, upload.single("file"), taskController.uploadAttachment);
router.post("/:taskKey/comments", checkIssueSecurity, commentController.create);

router.put("/:taskKey", checkIssueSecurity, requireTaskStatusEditor, taskController.update);
router.put("/reorder", requireTaskEditor, taskController.reorder);
router.put("/:taskKey/comments/:commentId", checkIssueSecurity, commentController.update);

router.delete("/:taskKey", checkIssueSecurity, requireTaskEditor, taskController.remove);
router.delete("/:taskKey/attachments/:publicId", checkIssueSecurity, requireTaskEditor, taskController.removeAttachment);
router.delete("/:taskKey/link/:linkedTaskKey", checkIssueSecurity, requireTaskEditor, taskController.unlink);
router.delete("/:taskKey/comments/:commentId", checkIssueSecurity, commentController.remove);

export default router;
