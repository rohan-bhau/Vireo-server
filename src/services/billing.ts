import Stripe from "stripe";
import Subscription, { ISubscription } from "../models/mongoose/Subscription";
import User from "../models/mongoose/User";
import { config } from "../config";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";

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
  memberLimit: number;
  projectLimit: number;
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
    memberLimit: 3,
    projectLimit: 2,
    features: [
      "Up to 3 team members",
      "Up to 2 projects",
      "Basic task management",
      "Kanban board",
      "14-day free trial of Pro features",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams that need more power",
    price: 1200,
    currency: "usd",
    interval: "month",
    memberLimit: 999999,
    projectLimit: 999999,
    features: [
      "Unlimited team members",
      "Unlimited projects",
      "AI-powered features",
      "Custom workflows & automation",
      "Sprints & epics",
      "Advanced reporting",
      "Priority support",
    ],
    priceId: config.stripe.proPriceId || undefined,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organizations with advanced needs",
    price: 2900,
    currency: "usd",
    interval: "month",
    memberLimit: 999999,
    projectLimit: 999999,
    features: [
      "Everything in Pro",
      "Advanced security & permissions",
      "Dedicated support",
      "Custom integrations",
      "Audit logs & compliance",
      "SLA guarantee",
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

export async function getSubscription(
  workspaceId: string
): Promise<ISubscription> {
  let sub = await Subscription.findOne({ workspaceId });
  if (!sub) {
    sub = await Subscription.create({
      workspaceId,
      plan: "free",
      status: "active",
      memberLimit: 3,
      projectLimit: 2,
    });
  }
  return sub;
}

export async function getPlans() {
  return PLANS.map(({ priceId, ...plan }) => plan);
}

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

  const memberCount = await prisma.workspaceMember.count({
    where: { workspaceId },
  });

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
        const plan = getPlanConfig(planId);
        const subscription = await getSubscription(workspaceId);
        subscription.stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : undefined;
        subscription.plan = planId;
        subscription.status = "active";
        subscription.memberLimit = plan.memberLimit;
        subscription.projectLimit = plan.projectLimit;
        subscription.cancelAtPeriodEnd = false;
        await subscription.save();
      }
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const sub = await Subscription.findOne({
        stripeSubscriptionId: stripeSub.id,
      });
      if (sub) {
        sub.status = stripeSub.status as ISubscription["status"];
        sub.currentPeriodStart = (stripeSub as any).current_period_start
          ? new Date((stripeSub as any).current_period_start * 1000)
          : undefined;
        sub.currentPeriodEnd = (stripeSub as any).current_period_end
          ? new Date((stripeSub as any).current_period_end * 1000)
          : undefined;
        sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
        await sub.save();
      }
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
        sub.memberLimit = 3;
        sub.projectLimit = 2;
        sub.cancelAtPeriodEnd = false;
        await sub.save();
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

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  subscription.plan = "pro";
  subscription.status = "trialing";
  subscription.trialStartedAt = new Date();
  subscription.trialEndsAt = trialEnd;
  subscription.memberLimit = 999999;
  subscription.projectLimit = 999999;
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
  subscription.memberLimit = 3;
  subscription.projectLimit = 2;
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
  const subscription = await getSubscription(workspaceId);

  if (type === "member") {
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId },
    });
    return memberCount < subscription.memberLimit;
  }

  if (type === "project") {
    const projectCount = await prisma.project.count({
      where: { workspaceId },
    });
    return projectCount < subscription.projectLimit;
  }

  return true;
}
