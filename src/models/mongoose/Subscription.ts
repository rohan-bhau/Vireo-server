import mongoose, { Document, Schema } from "mongoose";

export interface ISubscription extends Document {
  workspaceId: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: Date;
  trialStartedAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  memberLimit: number;
  projectLimit: number;
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
      enum: ["active", "canceled", "past_due", "trialing", "incomplete"],
      default: "active",
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
      default: 3,
    },
    projectLimit: {
      type: Number,
      default: 2,
    },
  },
  { timestamps: true }
);

const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;
