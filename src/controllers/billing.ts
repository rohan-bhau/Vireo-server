import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import {
  getSubscription,
  getPlans,
  getUsageStats,
  createCheckoutSession,
  confirmCheckoutSession,
  activateSubscriptionFromStripe,
  cancelSubscription,
  resumeSubscription,
  startTrial,
  getPortalSession,
  checkWorkspaceLimits,
} from "../services/billing";

function getWorkspaceId(req: AuthRequest): string {
  const id = req.params.workspaceId;
  return Array.isArray(id) ? id[0] : id;
}

export async function getPlansHandler(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const plans = await getPlans();
    res.json({ status: "success", data: { plans } });
  } catch (error) {
    next(error);
  }
}

export async function getSubscriptionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const subscription = await getSubscription(workspaceId);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    next(error);
  }
}

export async function getUsageStatsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const usage = await getUsageStats(workspaceId);
    res.json({ status: "success", data: usage });
  } catch (error) {
    next(error);
  }
}

export async function createCheckoutSessionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const { planId, successUrl, cancelUrl } = req.body;
    const userId = req.userId!;

    if (!planId || !["pro", "enterprise"].includes(planId)) {
      res.status(400).json({
        status: "error",
        message: "Invalid plan ID. Must be 'pro' or 'enterprise'.",
      });
      return;
    }

    if (!successUrl || !cancelUrl) {
      res.status(400).json({
        status: "error",
        message: "successUrl and cancelUrl are required",
      });
      return;
    }

    const result = await createCheckoutSession(
      workspaceId,
      userId,
      planId,
      successUrl,
      cancelUrl
    );
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function confirmCheckoutHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ status: "error", message: "sessionId is required" });
      return;
    }
    const subscription = await confirmCheckoutSession(workspaceId, sessionId);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    console.error("[billing] confirm-checkout failed:", error instanceof Error ? error.message : error);
    next(error);
  }
}

export async function activateSubscriptionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const subscription = await activateSubscriptionFromStripe(workspaceId);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    console.error("[billing] activate-subscription failed:", error instanceof Error ? error.message : error);
    next(error);
  }
}

export async function cancelSubscriptionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const subscription = await cancelSubscription(workspaceId);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    next(error);
  }
}

export async function resumeSubscriptionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const subscription = await resumeSubscription(workspaceId);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    next(error);
  }
}

export async function startTrialHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const subscription = await startTrial(workspaceId);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    next(error);
  }
}

export async function getPortalSessionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const returnUrl =
      req.body.returnUrl ||
      `${req.protocol}://${req.get("host")}/w/${workspaceId}/settings/billing`;
    const result = await getPortalSession(workspaceId, returnUrl);
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function checkLimitsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = getWorkspaceId(req);
    const type = req.query.type as string | undefined;
    if (!type || !["member", "project"].includes(type)) {
      res.status(400).json({
        status: "error",
        message: "type query param must be 'member' or 'project'",
      });
      return;
    }
    const allowed = await checkWorkspaceLimits(workspaceId, type as "member" | "project");
    res.json({ status: "success", data: { allowed, type } });
  } catch (error) {
    next(error);
  }
}
