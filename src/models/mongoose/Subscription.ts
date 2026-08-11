import mongoose, { Document, Schema } from "mongoose";

export type SubscriptionPlan = "free" | "pro" | "enterprise";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface ISubscription extends Document {
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: Date;
  trialStartedAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  memberLimit: number | null;
  automationRunLimit: number | null;
  aiCallLimit: number | null;
  storageLimitMB: number | null;
  automationRunsUsedThisPeriod: number;
  aiCallsUsedThisPeriod: number;
  storageUsedMB: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    workspaceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "canceled"],
      default: "trialing",
    },
    stripeCustomerId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
    },
    trialEndsAt: {
      type: Date,
    },
    trialStartedAt: {
      type: Date,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    memberLimit: {
      type: Number,
      default: 10,
    },
    automationRunLimit: {
      type: Number,
      default: 100,
    },
    aiCallLimit: {
      type: Number,
      default: 20,
    },
    storageLimitMB: {
      type: Number,
      default: 2000,
    },
    automationRunsUsedThisPeriod: {
      type: Number,
      default: 0,
    },
    aiCallsUsedThisPeriod: {
      type: Number,
      default: 0,
    },
    storageUsedMB: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;
