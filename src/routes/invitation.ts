import { Router } from "express";
import * as invitationController from "../controllers/invitation";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/my", invitationController.getMyInvitations);
router.post("/:token/accept", invitationController.accept);
router.post("/:token/decline", invitationController.decline);

export default router;
