import { Router } from "express";
import * as conversationController from "../controllers/conversation";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/:conversationId", conversationController.getConversation);
router.get("/workspace/:workspaceId", conversationController.getConversations);
router.post("/", conversationController.createConversation);
router.post("/dm", conversationController.getOrCreateDMConversation);
router.get("/:conversationId/messages", conversationController.getMessages);
router.post("/:conversationId/messages", conversationController.sendMessage);
router.put("/:conversationId/read", conversationController.markRead);
router.post("/:conversationId/members", conversationController.addMember);
router.delete("/:conversationId/members/:userId", conversationController.removeMember);

export default router;
