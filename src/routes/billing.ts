import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireWorkspaceMember, requireWorkspaceRole } from "../middleware/workspace";
import {
  getPlansHandler,
  getSubscriptionHandler,
  createCheckoutSessionHandler,
  cancelSubscriptionHandler,
  resumeSubscriptionHandler,
  startTrialHandler,
  getPortalSessionHandler,
  checkLimitsHandler,
} from "../controllers/billing";

const router = Router();

router.get("/plans", getPlansHandler);

router.get(
  "/:workspaceId/subscription",
  authenticate,
  requireWorkspaceMember,
  getSubscriptionHandler
);

router.post(
  "/:workspaceId/create-checkout-session",
  authenticate,
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  createCheckoutSessionHandler
);

router.post(
  "/:workspaceId/cancel",
  authenticate,
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  cancelSubscriptionHandler
);

router.post(
  "/:workspaceId/resume",
  authenticate,
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  resumeSubscriptionHandler
);

router.post(
  "/:workspaceId/start-trial",
  authenticate,
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  startTrialHandler
);

router.post(
  "/:workspaceId/portal-session",
  authenticate,
  requireWorkspaceMember,
  requireWorkspaceRole("ADMIN"),
  getPortalSessionHandler
);

router.get(
  "/:workspaceId/check-limits",
  authenticate,
  requireWorkspaceMember,
  checkLimitsHandler
);

export default router;
