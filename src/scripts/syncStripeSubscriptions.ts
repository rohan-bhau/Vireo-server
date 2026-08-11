/**
 * Reconciles Mongo Subscriptions against live Stripe data. Fixes workspaces
 * whose plan never flipped to Pro/Enterprise because a checkout webhook was
 * missed (e.g., Stripe endpoint not configured yet).
 *
 * Usage:
 *   npx tsx src/scripts/syncStripeSubscriptions.ts            # dry-run (default)
 *   npx tsx src/scripts/syncStripeSubscriptions.ts --execute  # real run
 */
import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../config";
import { connectMongoDB } from "../config/mongoose";
import Subscription from "../models/mongoose/Subscription";

const execute = process.argv.includes("--execute");

function stripeClient(): Stripe {
  if (!config.stripe.secretKey) {
    throw new Error("STRIPE_SECRET_KEY not set in .env");
  }
  return new Stripe(config.stripe.secretKey, {
    apiVersion: "2026-06-24.dahlia",
  });
}

function planFromStripe(stripeSub: Stripe.Subscription): "pro" | "enterprise" | null {
  const meta = stripeSub.metadata?.planId;
  if (meta === "pro" || meta === "enterprise") return meta;
  const priceId = stripeSub.items.data[0]?.price?.id;
  if (priceId && config.stripe.proPriceId && priceId === config.stripe.proPriceId) return "pro";
  if (priceId && config.stripe.enterprisePriceId && priceId === config.stripe.enterprisePriceId) return "enterprise";
  return null;
}

function mapStripeStatus(status: string): string {
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

async function main() {
  await connectMongoDB();
  const stripe = stripeClient();

  const subs = await Subscription.find({
    $or: [
      { stripeSubscriptionId: { $exists: true, $ne: "" } },
      { stripeCustomerId: { $exists: true, $ne: "" } },
    ],
  }).lean();

  console.log(`\nSubscriptions linked to Stripe: ${subs.length}`);

  let checked = 0;
  let changed = 0;

  for (const sub of subs) {
    let stripeSub: Stripe.Subscription | undefined;

    if (sub.stripeSubscriptionId) {
      try {
        stripeSub = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId as string
        );
      } catch {}
    }

    if (!stripeSub && sub.stripeCustomerId) {
      const list = await stripe.subscriptions.list({
        customer: sub.stripeCustomerId as string,
        status: "all",
        limit: 10,
      });
      stripeSub = list.data.find((s) => s.status !== "canceled") || list.data[0];
    }

    if (!stripeSub) {
      console.log(`  [skip] ws=${sub.workspaceId} — no live Stripe subscription`);
      continue;
    }

    checked++;
    const plan = planFromStripe(stripeSub);
    const nextPlan = plan ?? "free";
    const nextStatus = mapStripeStatus(stripeSub.status);

    const raw = stripeSub as any;
    const periodStart = raw.current_period_start
      ? new Date(raw.current_period_start * 1000)
      : sub.currentPeriodStart ?? undefined;
    const periodEnd = raw.current_period_end
      ? new Date(raw.current_period_end * 1000)
      : sub.currentPeriodEnd ?? undefined;

    const periodChanged = periodEnd
      ? !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() !== periodEnd.getTime()
      : !!sub.currentPeriodEnd;

    const docChanged =
      sub.plan !== nextPlan ||
      sub.status !== nextStatus ||
      (sub.stripeSubscriptionId as string | undefined) !== stripeSub.id ||
      periodChanged ||
      sub.cancelAtPeriodEnd !== stripeSub.cancel_at_period_end;

    const periodStr = periodEnd
      ? periodEnd.toISOString().slice(0, 10)
      : "n/a";

    console.log(
      `  [${docChanged ? "CHANGE" : "ok   "}] ws=${sub.workspaceId} ` +
        `plan ${sub.plan}->${nextPlan} | status ${sub.status}->${nextStatus} | period -> ${periodStr}`
    );

    if (!execute) continue;

    await Subscription.updateOne(
      { _id: sub._id },
      {
        plan: nextPlan,
        status: nextStatus,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      }
    );
    if (docChanged) changed++;
  }

  console.log(`\nDone. Checked ${checked} Stripe subscriptions.`);
  console.log(
    execute
      ? `Applied changes to ${changed} subscription(s).`
      : "Dry-run — re-run with --execute to apply changes."
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
