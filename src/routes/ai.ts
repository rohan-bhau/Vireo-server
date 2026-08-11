import { Router } from "express";
import * as aiController from "../controllers/ai";
import { authenticate } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(authenticate);
router.use(aiRateLimiter);

router.post("/ticket-draft", aiController.generateTicketDraft);
router.post("/summarize/:taskKey", aiController.summarizeThread);
router.post("/comment-reply", aiController.suggestCommentReply);
router.post("/triage", aiController.smartTriage);
router.post("/sprint-plan", aiController.suggestSprintPlan);
router.post("/chat", aiController.chatWithAI);
router.get("/history", aiController.getAIHistory);
router.get("/conversations", aiController.getAIConversations);
router.get("/conversations/:conversationId", aiController.getAIConversation);

export default router;