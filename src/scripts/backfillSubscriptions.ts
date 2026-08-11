/**
 * Backfills a Subscription document for every workspace that lacks one.
 *
 * Usage:
 *   npx tsx src/scripts/backfillSubscriptions.ts            # dry-run (default)
 *   npx tsx src/scripts/backfillSubscriptions.ts --execute  # real run
 */
import mongoose from "mongoose";
import { prisma } from "../config/prisma";
import { connectMongoDB } from "../config/mongoose";
import Subscription from "../models/mongoose/Subscription";
import { createSubscription } from "../services/billing";

const execute = process.argv.includes("--execute");

async function main() {
  await connectMongoDB();
  await prisma.$connect();

  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, createdAt: true },
  });

  const subWorkspaceIds = new Set(
    (await Subscription.find().select("workspaceId").lean()).map(
      (s) => s.workspaceId as string
    )
  );

  const missing = workspaces.filter((w) => !subWorkspaceIds.has(w.id));

  console.log(`\nTotal workspaces: ${workspaces.length}`);
  console.log(`Workspaces with subscription: ${workspaces.length - missing.length}`);
  console.log(`Workspaces missing subscription: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log("Nothing to backfill. Exiting.");
    await cleanup();
    return;
  }

  for (const w of missing) {
    console.log(`  - ${w.id}  (${w.name})`);
  }

  if (!execute) {
    console.log("\nDry-run complete. Re-run with --execute to create subscriptions.");
    await cleanup();
    return;
  }

  let created = 0;
  for (const w of missing) {
    try {
      await createSubscription(w.id);
      created++;
      console.log(`Created subscription for ${w.id}`);
    } catch (err) {
      console.error(`Failed for ${w.id}:`, err);
    }
  }

  console.log(`\nDone. Created ${created}/${missing.length} subscriptions.`);
  await cleanup();
}

async function cleanup() {
  await prisma.$disconnect();
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  await mongoose.disconnect();
  process.exit(1);
});
