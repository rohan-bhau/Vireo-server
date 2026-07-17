import { Router } from "express";
import * as notificationController from "../controllers/notification";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.put("/:id/read", notificationController.markRead);
router.put("/read-all", notificationController.markAllRead);

export default router;
