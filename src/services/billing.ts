import Stripe from "stripe";
import Subscription, {
  ISubscription,
  SubscriptionPlan,
} from "../models/mongoose/Subscription";
import Task from "../models/mongoose/Task";
import User from "../models/mongoose/User";
import { config } from "../config";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";
import { getIO } from "../socket";
import {
  PLAN_LIMITS,
  resolveLimits,
  automationRunLimitFor,
  hasFeature,
  type PlanFeature,
} from "./plan";

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: "2026-06-24.dahlia" })
  : null;

export interface PlanConfig {
  id: "free" | "pro" | "enterprise";
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  memberLimit: number | null;
  aiCallLimit: number | null;
  storageLimitMB: number | null;
  automationRunLimitLabel: string;
  features: string[];
  priceId?: string;
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    description: "For small teams getting started",
    price: 0,
    currency: "usd",
    interval: "month",
    memberLimit: 10,
    aiCallLimit: 20,
    storageLimitMB: 2000,
    automationRunLimitLabel: "100 runs / month",
    features: [
      "Up to 10 team members",
      "Unlimited projects",
      "100 automation runs / month",
      "20 AI calls / month",
      "2 GB storage",
      "14-day free trial",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams that need more power",
    price: 2400,
    currency: "usd",
    interval: "month",
    memberLimit: null,
    aiCallLimit: 500,
    storageLimitMB: 10000,
    automationRunLimitLabel: "1,000 runs per member / month",
    features: [
      "Unlimited team members (per-seat)",
      "Unlimited projects",
      "Roadmap / Timeline view",
      "Custom fields & custom workflows",
      "500 AI calls / month",
      "10 GB storage",
    ],
    priceId: config.stripe.proPriceId || undefined,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organizations with advanced needs",
    price: 4900,
    currency: "usd",
    interval: "month",
    memberLimit: null,
    aiCallLimit: null,
    storageLimitMB: null,
    automationRunLimitLabel: "Unlimited",
    features: [
      "Everything in Pro",
      "Unlimited AI calls & storage",
      "SSO & audit logs",
      "Advanced security & permissions",
      "Dedicated support",
      "Custom contracts & invoicing",
    ],
    priceId: config.stripe.enterprisePriceId || undefined,
  },
];

function getPlanConfig(planId: string): PlanConfig {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new AppError("Invalid plan", 400);
  return plan;
}

/**
 * Pushes the latest subscription state to every connected workspace member so
 * the billing page and plan-gated features update instantly after a change.
 */
export function emitSubscriptionUpdated(workspaceId: string) {
  const io = getIO();
  if (!io) return;
  io.to(`workspace:${workspaceId}`).emit("subscription-updated", { workspaceId });
}

const TRIAL_DAYS = 14;
const PERIOD_DAYS = 30;

/**
 * Maps a raw Stripe subscription status onto our (smaller) status enum.
 * Anything we don't model is coerced to the nearest equivalent so a stray
 * Stripe value can never fail Mongo validation.
 */
function mapStripeStatus(status: string): ISubscription["status"] {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
      return status;
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "active";
    default:
      return "canceled";
  }
}

/**
 * Applies the relevant state of a Stripe Subscription onto our Mongo
 * Subscription record. Shared by the subscription.created / updated /
 * deleted webhook cases so plan, period, and status always stay in sync.
 */
async function syncStripeSubscriptionToDb(stripeSub: Stripe.Subscription) {
  const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
  if (!sub) return;

  const raw = stripeSub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  sub.status = mapStripeStatus(stripeSub.status);
  sub.currentPeriodStart = raw.current_period_start
    ? new Date(raw.current_period_start * 1000)
    : undefined;
  sub.currentPeriodEnd = raw.current_period_end
    ? new Date(raw.current_period_end * 1000)
    : undefined;
  sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;

  const planId = stripeSub.metadata?.planId;
  if (planId === "pro" || planId === "enterprise") {
    sub.plan = planId;
  }

  await sub.save();
  emitSubscriptionUpdated(sub.workspaceId);
}

export function billingSettingsUrl(workspaceId: string): string {
  return `/w/${workspaceId}/settings/billing`;
}

/**
 * Create a subscription eagerly at workspace-creation time.
 * New workspaces default to the Free plan with a 14-day trial and a fresh
 * 30-day rolling period.
 */
export async function createSubscription(workspaceId: string): Promise<ISubscription> {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const periodEnd = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const defaults = PLAN_LIMITS.free;

  return Subscription.create({
    workspaceId,
    plan: "free",
    status: "trialing",
    trialStartedAt: now,
    trialEndsAt: trialEnd,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    memberLimit: defaults.memberLimit,
    automationRunLimit: 100,
    aiCallLimit: defaults.aiCallLimit,
    storageLimitMB: defaults.storageLimitMB,
    automationRunsUsedThisPeriod: 0,
    aiCallsUsedThisPeriod: 0,
    storageUsedMB: 0,
    cancelAtPeriodEnd: false,
  });
}

/**
 * Strict read — a Subscription is expected to exist for every workspace
 * (created eagerly at workspace-creation time). Never lazily creates.
 */
export async function getSubscription(
  workspaceId: string
): Promise<ISubscription> {
  const sub = await Subscription.findOne({ workspaceId });
  if (!sub) {
    throw new AppError("Subscription not found for this workspace", 404);
  }
  return sub;
}

/**
 * Rolls the 30-day usage window forward when it has elapsed, resetting the
 * monthly usage counters. Safe to call before every usage check.
 */
export async function ensureCurrentPeriod(sub: ISubscription): Promise<ISubscription> {
  const now = new Date();
  if (
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() > now.getTime()
  ) {
    return sub;
  }

  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = new Date(
    now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000
  );
  sub.automationRunsUsedThisPeriod = 0;
  sub.aiCallsUsedThisPeriod = 0;
  await sub.save();
  return sub;
}

export async function getPlans() {
  return PLANS.map(({ priceId, ...plan }) => plan);
}

export async function getMemberCount(workspaceId: string): Promise<number> {
  return prisma.workspaceMember.count({ where: { workspaceId } });
}

export async function getPendingInviteCount(workspaceId: string): Promise<number> {
  return prisma.invitation.count({
    where: { workspaceId, status: "PENDING" },
  });
}

/**
 * Recompute stored storage usage from actual attachment sizes (bytes) across
 * all tasks in the workspace. Attachment records created before this feature
 * carry no `size`, so they contribute 0 until re-uploaded.
 */
export async function recomputeStorageUsed(workspaceId: string): Promise<number> {
  const sub = await getSubscription(workspaceId);

  const agg = await Task.aggregate<{ totalBytes: number }>([
    { $match: { workspaceId } },
    { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: null,
        totalBytes: { $sum: { $ifNull: ["$attachments.size", 0] } },
      },
    },
  ]);

  const totalBytes = agg[0]?.totalBytes || 0;
  const usedMB = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;

  sub.storageUsedMB = usedMB;
  await sub.save();
  return usedMB;
}

export async function getStorageUsedMB(workspaceId: string): Promise<number> {
  return recomputeStorageUsed(workspaceId);
}

/* ------------------------------------------------------------------ */
/* Usage / limit helpers (plan-derived, single source of truth)        */
/* ------------------------------------------------------------------ */

export async function getResolvedLimits(workspaceId: string) {
  const sub = await getSubscription(workspaceId);
  const memberCount = await getMemberCount(workspaceId);
  return resolveLimits(sub.plan, memberCount);
}

/* ---------------- Member limit ---------------- */

export interface MemberLimitStatus {
  allowed: boolean;
  atLimit: boolean;
  memberCount: number;
  pendingInvites: number;
  memberLimit: number | null;
  plan: SubscriptionPlan;
}

export async function getMemberLimitStatus(
  workspaceId: string,
  opts?: { includePending?: boolean }
): Promise<MemberLimitStatus> {
  const sub = await getSubscription(workspaceId);
  const memberCount = await getMemberCount(workspaceId);
  const pendingInvites = opts?.includePending === false ? 0 : await getPendingInviteCount(workspaceId);
  const memberLimit = resolveLimits(sub.plan, memberCount).memberLimit;

  // `null` limit => unlimited, never block.
  const effective = memberLimit === null ? Infinity : memberLimit;
  const atLimit = memberCount + pendingInvites >= effective;

  return {
    allowed: memberLimit === null || !atLimit,
    atLimit,
    memberCount,
    pendingInvites,
    memberLimit,
    plan: sub.plan,
  };
}

/**
 * Blocks an invitation when the seat cap would be exceeded. Seats are
 * counted as active members plus pending invitations so pending invites
 * reserve a seat.
 */
export async function assertMemberLimitAllowed(workspaceId: string) {
  const status = await getMemberLimitStatus(workspaceId);
  if (status.memberLimit === null) return;
  if (!status.allowed) {
    throw new AppError(
      `Member limit reached: the ${status.plan} plan allows up to ${status.memberLimit} members (${status.memberCount} active + ${status.pendingInvites} pending). Upgrade to add more: ${billingSettingsUrl(workspaceId)}`,
      403
    );
  }
}

export async function enforceMemberLimit(workspaceId: string) {
  const status = await getMemberLimitStatus(workspaceId);
  return {
    allowed: status.allowed,
    atLimit: status.atLimit,
    memberCount: status.memberCount,
    memberLimit: status.memberLimit,
  };
}

/* ---------------- Automation run limit ---------------- */

/**
 * Returns whether another automation run is allowed this period. Does not
 * throw — automation triggers run fire-and-forget, so callers skip.
 */
export async function checkAutomationRunLimit(
  workspaceId: string
): Promise<{ allowed: boolean; limit: number | null; used: number; plan: SubscriptionPlan }> {
  const sub = await getSubscription(workspaceId);
  await ensureCurrentPeriod(sub);
  const memberCount = await getMemberCount(workspaceId);
  const limit = automationRunLimitFor(sub.plan, memberCount);

  return {
    allowed: limit === null || sub.automationRunsUsedThisPeriod < limit,
    limit,
    used: sub.automationRunsUsedThisPeriod,
    plan: sub.plan,
  };
}

export async function recordAutomationRun(workspaceId: string) {
  const sub = await getSubscription(workspaceId);
  await ensureCurrentPeriod(sub);
  sub.automationRunsUsedThisPeriod += 1;
  await sub.save();
}

/* ---------------- AI call limit ---------------- */

/**
 * Blocks an AI call when the monthly budget is exhausted. Throws with a
 * Billing-linked message so the caller surfaces it to the client.
 */
export async function checkAiCallLimit(workspaceId: string) {
  const sub = await getSubscription(workspaceId);
  await ensureCurrentPeriod(sub);
  const limits = resolveLimits(sub.plan, await getMemberCount(workspaceId));
  const limit = limits.aiCallLimit;

  if (limit !== null && sub.aiCallsUsedThisPeriod >= limit) {
    throw new AppError(
      `AI call limit reached: the ${sub.plan} plan allows ${limit} AI calls per month and you have used ${sub.aiCallsUsedThisPeriod}. Upgrade or wait for the next billing cycle: ${billingSettingsUrl(workspaceId)}`,
      429
    );
  }
}

export async function recordAiCall(workspaceId: string) {
  const sub = await getSubscription(workspaceId);
  await ensureCurrentPeriod(sub);
  sub.aiCallsUsedThisPeriod += 1;
  await sub.save();
}

/**
 * Non-fatal AI limit guard: unlike checkAiCallLimit, it never throws when a
 * subscription record is missing (e.g. workspace created before billing was
 * wired up) — AI features must keep working regardless of billing state.
 */
export async function tryCheckAiCallLimit(workspaceId: string): Promise<void> {
  try {
    await checkAiCallLimit(workspaceId);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) return;
    throw err;
  }
}

export async function tryRecordAiCall(workspaceId: string): Promise<void> {
  try {
    await recordAiCall(workspaceId);
  } catch {
    // Never let usage tracking break the AI call itself.
  }
}

/* ---------------- Storage limit ---------------- */

export async function checkStorageLimit(workspaceId: string, newBytes: number) {
  const sub = await getSubscription(workspaceId);
  const usedMB = await recomputeStorageUsed(workspaceId);
  const limits = resolveLimits(sub.plan, await getMemberCount(workspaceId));
  const limitMB = limits.storageLimitMB;
  const newMB = newBytes / (1024 * 1024);

  if (limitMB !== null && usedMB + newMB > limitMB) {
    throw new AppError(
      `Storage limit reached: the ${sub.plan} plan allows ${formatMB(limitMB)} of attachments (currently using ${formatMB(usedMB)}). Free up space or upgrade: ${billingSettingsUrl(workspaceId)}`,
      413
    );
  }
}

export async function recordStorageUsed(workspaceId: string, bytes: number) {
  const sub = await getSubscription(workspaceId);
  await ensureCurrentPeriod(sub);
  sub.storageUsedMB = Math.round((sub.storageUsedMB + bytes / (1024 * 1024)) * 10) / 10;
  await sub.save();
}

/* ---------------- Feature gates ---------------- */

export function planHasFeature(workspaceId: string, feature: PlanFeature): Promise<boolean> {
  return getSubscription(workspaceId).then((sub) => hasFeature(sub.plan, feature));
}

/**
 * Free workspaces can view but not edit workflow configuration.
 */
export async function assertWorkflowEditingAllowed(workspaceId: string) {
  const sub = await getSubscription(workspaceId);
  if (!hasFeature(sub.plan, "customWorkflows")) {
    throw new AppError(
      `Custom workflows are a ${sub.plan === "free" ? "Free" : "paid"} plan limitation — editing workflows requires Pro or Enterprise. Upgrade to unlock: ${billingSettingsUrl(workspaceId)}`,
      403
    );
  }
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${mb / 1024} GB`;
  return `${mb} MB`;
}

/* ------------------------------------------------------------------ */
/* Billing page / subscription API                                     */
/* ------------------------------------------------------------------ */

export interface SubscriptionUsage {
  memberCount: number;
  storageUsedMB: number;
}

export interface SubscriptionWithUsage {
  subscription: Record<string, any>;
  limits: ReturnType<typeof resolveLimits>;
  usage: SubscriptionUsage;
}

export async function getSubscriptionWithUsage(
  workspaceId: string
): Promise<SubscriptionWithUsage> {
  const sub = await getSubscription(workspaceId);
  await ensureCurrentPeriod(sub);
  const memberCount = await getMemberCount(workspaceId);
  const storageUsedMB = await recomputeStorageUsed(workspaceId);

  return {
    subscription: sub.toObject(),
    limits: resolveLimits(sub.plan, memberCount),
    usage: { memberCount, storageUsedMB },
  };
}

export async function getUsageStats(workspaceId: string) {
  const withUsage = await getSubscriptionWithUsage(workspaceId);
  return {
    memberCount: withUsage.usage.memberCount,
    storageUsed: withUsage.usage.storageUsedMB,
    memberLimit: withUsage.limits.memberLimit,
    storageLimit: withUsage.limits.storageLimitMB,
    automationRunsUsed: withUsage.subscription.automationRunsUsedThisPeriod,
    automationRunLimit: withUsage.limits.automationRunLimit,
    aiCallsUsed: withUsage.subscription.aiCallsUsedThisPeriod,
    aiCallLimit: withUsage.limits.aiCallLimit,
    plan: withUsage.subscription.plan,
  };
}

/* ------------------------------------------------------------------ */
/* Stripe helpers (kept for compatibility; payment is out of scope)    */
/* ------------------------------------------------------------------ */

export async function createCheckoutSession(
  workspaceId: string,
  userId: string,
  planId: "pro" | "enterprise",
  successUrl: string,
  cancelUrl: string
) {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 500);
  }

  const plan = getPlanConfig(planId);
  if (!plan.priceId) {
    throw new AppError("Price ID not configured for this plan", 500);
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const memberCount = await getMemberCount(workspaceId);

  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId, workspaceId },
    });
    stripeCustomerId = customer.id;
    user.stripeCustomerId = stripeCustomerId;
    await user.save();
  }

  const subscription = await getSubscription(workspaceId);

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [
      {
        price: plan.priceId,
        quantity: Math.max(1, memberCount),
      },
    ],
    subscription_data: {
      trial_settings: {
        end_behavior: {
          missing_payment_method: "cancel",
        },
      },
      trial_period_days: 14,
      metadata: {
        workspaceId,
        planId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      workspaceId,
      planId,
    },
  });

  if (!subscription.stripeCustomerId) {
    subscription.stripeCustomerId = stripeCustomerId;
    await subscription.save();
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Verifies a completed Stripe checkout session and applies the chosen plan to
 * the workspace. This is a webhook-independent fallback: it guarantees the
 * plan (and its feature unlocks) activate immediately on return from Stripe,
 * even if the webhook is delayed or not configured.
 */
export async function confirmCheckoutSession(
  workspaceId: string,
  sessionId: string
) {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 500);
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch {
    throw new AppError("Could not verify the checkout session", 400);
  }

  if (session.metadata?.workspaceId !== workspaceId) {
    throw new AppError("Checkout session does not belong to this workspace", 400);
  }

  const planId = session.metadata?.planId as "pro" | "enterprise" | undefined;
  if (planId !== "pro" && planId !== "enterprise") {
    throw new AppError("Invalid plan in checkout session", 400);
  }

  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    throw new AppError("Payment has not completed for this session", 400);
  }

  const stripeSub = session.subscription;
  const stripeSubId =
    typeof stripeSub === "string" ? stripeSub : stripeSub?.id;

  const subscription = await getSubscription(workspaceId);

  let status: ISubscription["status"] = "active";
  if (
    typeof stripeSub === "object" &&
    stripeSub?.status === "trialing"
  ) {
    status = "trialing";
  }

  subscription.stripeSubscriptionId = stripeSubId;
  subscription.plan = planId;
  subscription.status = status;
  subscription.cancelAtPeriodEnd = false;
  await subscription.save();

  emitSubscriptionUpdated(workspaceId);

  return subscription;
}

export async function cancelSubscription(workspaceId: string) {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 500);
  }

  const subscription = await getSubscription(workspaceId);
  if (!subscription.stripeSubscriptionId) {
    throw new AppError("No active subscription to cancel", 400);
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  subscription.cancelAtPeriodEnd = true;
  await subscription.save();

  return subscription;
}

export async function resumeSubscription(workspaceId: string) {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 500);
  }

  const subscription = await getSubscription(workspaceId);
  if (!subscription.stripeSubscriptionId) {
    throw new AppError("No active subscription to resume", 400);
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  subscription.cancelAtPeriodEnd = false;
  await subscription.save();

  return subscription;
}

export async function handleStripeWebhook(
  rawBody: string | Buffer,
  signature: string
) {
  if (!stripe || !config.stripe.webhookSecret) {
    throw new AppError("Stripe is not configured", 500);
  }

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const planId = session.metadata?.planId as "pro" | "enterprise";

      if (workspaceId && planId) {
        const subscription = await getSubscription(workspaceId);
        subscription.stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : undefined;
        subscription.plan = planId;
        subscription.status = "active";
        subscription.cancelAtPeriodEnd = false;
        await subscription.save();
        emitSubscriptionUpdated(workspaceId);
      }
      break;
    }

    case "customer.subscription.created": {
      const stripeSub = event.data.object as Stripe.Subscription;
      await syncStripeSubscriptionToDb(stripeSub);
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      await syncStripeSubscriptionToDb(stripeSub);
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const sub = await Subscription.findOne({
        stripeSubscriptionId: stripeSub.id,
      });
      if (sub) {
        sub.plan = "free";
        sub.status = "canceled";
        sub.stripeSubscriptionId = undefined;
        sub.cancelAtPeriodEnd = false;
        await sub.save();
        emitSubscriptionUpdated(sub.workspaceId);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Record<string, any>;
      const stripeSubId = invoice.subscription;
      if (stripeSubId) {
        const subId = typeof stripeSubId === "string" ? stripeSubId : stripeSubId.id;
        const sub = await Subscription.findOne({
          stripeSubscriptionId: subId,
        });
        if (sub) {
          sub.status = "active";
          await sub.save();
          emitSubscriptionUpdated(sub.workspaceId);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Record<string, any>;
      const stripeSubId = invoice.subscription;
      if (stripeSubId) {
        const subId = typeof stripeSubId === "string" ? stripeSubId : stripeSubId.id;
        const sub = await Subscription.findOne({
          stripeSubscriptionId: subId,
        });
        if (sub) {
          sub.status = "past_due";
          await sub.save();
          emitSubscriptionUpdated(sub.workspaceId);
        }
      }
      break;
    }
  }

  return { received: true };
}

export async function updateSubscriptionQuantity(
  workspaceId: string,
  quantity: number
) {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 500);
  }

  const subscription = await getSubscription(workspaceId);
  if (!subscription.stripeSubscriptionId) {
    return;
  }

  const stripeSub = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  if (stripeSub.items.data.length > 0) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        {
          id: stripeSub.items.data[0].id,
          quantity,
        },
      ],
    });
  }
}

export async function startTrial(workspaceId: string) {
  const subscription = await getSubscription(workspaceId);
  if (subscription.trialEndsAt && subscription.trialEndsAt > new Date()) {
    return subscription;
  }

  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  subscription.plan = "pro";
  subscription.status = "trialing";
  subscription.trialStartedAt = new Date();
  subscription.trialEndsAt = trialEnd;
  await subscription.save();

  return subscription;
}

export async function endTrial(workspaceId: string) {
  const subscription = await getSubscription(workspaceId);
  if (!subscription.trialEndsAt || subscription.trialEndsAt > new Date()) {
    return subscription;
  }

  if (subscription.stripeSubscriptionId) {
    return subscription;
  }

  subscription.plan = "free";
  subscription.status = "active";
  subscription.trialEndsAt = undefined;
  subscription.trialStartedAt = undefined;
  await subscription.save();

  return subscription;
}

export async function getPortalSession(
  workspaceId: string,
  returnUrl: string
) {
  if (!stripe) {
    throw new AppError("Stripe is not configured", 500);
  }

  const subscription = await getSubscription(workspaceId);
  if (!subscription.stripeCustomerId) {
    throw new AppError("No Stripe customer found", 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function checkWorkspaceLimits(
  workspaceId: string,
  type: "member" | "project"
): Promise<boolean> {
  // Projects are unlimited on every plan — real Jira's lever is seats, not
  // project count. Only the member limit is ever enforced.
  if (type === "project") return true;

  const status = await getMemberLimitStatus(workspaceId);
  return status.allowed;
}

export async function checkAndExpireTrials() {
  const expired = await Subscription.find({
    trialEndsAt: { $lt: new Date() },
    stripeSubscriptionId: { $exists: false },
    plan: { $ne: "free" },
  });

  let downgraded = 0;
  for (const sub of expired) {
    sub.plan = "free";
    sub.status = "active";
    sub.trialEndsAt = undefined;
    sub.trialStartedAt = undefined;
    await sub.save();
    downgraded++;
  }

  return { downgraded };
}

export async function enforceProjectLimit(_workspaceId: string) {
  return { allowed: true, atLimit: false, projectCount: 0, projectLimit: null };
}
