import type { SubscriptionPlan } from "../models/mongoose/Subscription";

export type PlanFeature =
  | "roadmap"
  | "customFields"
  | "customWorkflows"
  | "ssoAuditLogs";

/**
 * Single source of truth for plan limits and feature gating.
 *
 * All limits are derived from `plan` (never read from stored Subscription
 * limit fields) so that changing a workspace's plan — even manually in the
 * database — is reflected consistently in both enforcement and display.
 *
 * `null` means no hard cap (unlimited).
 */
export interface PlanLimits {
  memberLimit: number | null;
  automationRunLimit: number | null;
  aiCallLimit: number | null;
  storageLimitMB: number | null;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, Omit<PlanLimits, "automationRunLimit"> & { automationRunLimitPerMember: number | null }> = {
  free: {
    memberLimit: 10,
    automationRunLimitPerMember: null, // flat 100/month, not per-member
    aiCallLimit: 20,
    storageLimitMB: 2000, // 2 GB
  },
  pro: {
    memberLimit: null, // per-seat model, no hard member cap
    automationRunLimitPerMember: 1000, // 1000 runs per member, pooled
    aiCallLimit: 500,
    storageLimitMB: 10000, // 10 GB
  },
  enterprise: {
    memberLimit: null,
    automationRunLimitPerMember: null,
    aiCallLimit: null,
    storageLimitMB: null,
  },
};

/**
 * Flat automation run limit for a plan given the current member count.
 * - free: 100 runs/month (fixed)
 * - pro: 1000 * current member count, pooled (computed at check-time)
 * - enterprise: null (unlimited)
 */
export function automationRunLimitFor(
  plan: SubscriptionPlan,
  memberCount: number
): number | null {
  if (plan === "enterprise") return null;
  if (plan === "pro") {
    return Math.max(1, memberCount) * 1000;
  }
  return 100;
}

export function resolveLimits(
  plan: SubscriptionPlan,
  memberCount: number
): PlanLimits {
  const cfg = PLAN_LIMITS[plan];
  return {
    memberLimit: cfg.memberLimit,
    automationRunLimit: automationRunLimitFor(plan, memberCount),
    aiCallLimit: cfg.aiCallLimit,
    storageLimitMB: cfg.storageLimitMB,
  };
}

/**
 * Boolean capability flags unlocked by plan. Kept in one place so the
 * roadmap/custom-fields/custom-workflows/SSO gating all read the same map.
 */
export function hasFeature(
  plan: SubscriptionPlan,
  feature: PlanFeature
): boolean {
  switch (feature) {
    case "roadmap":
    case "customFields":
    case "customWorkflows":
      return plan === "pro" || plan === "enterprise";
    case "ssoAuditLogs":
      return plan === "enterprise";
  }
}
