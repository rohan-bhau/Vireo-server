import { Router } from "express";
import * as conversationController from "../controllers/conversation";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/history", conversationController.getCallHistory);

export default router;
