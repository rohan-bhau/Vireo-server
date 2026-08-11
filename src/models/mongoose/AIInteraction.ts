import mongoose, { Schema } from "mongoose";

export type AIFeatureType =
  | "ticket_writer"
  | "summarizer"
  | "smart_triage"
  | "sprint_planner"
  | "chat_assistant"
  | "comment_reply";

export interface IAIInteraction {
  userId: string;
  feature: AIFeatureType;
  prompt: string;
  response: string;
  model: string;
  tokensUsed: number;
  duration: number;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  createdAt: Date;
}

const aiInteractionSchema = new Schema<IAIInteraction>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    feature: {
      type: String,
      enum: ["ticket_writer", "summarizer", "smart_triage", "sprint_planner", "chat_assistant", "comment_reply"],
      required: true,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    response: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    conversationId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
);

aiInteractionSchema.index({ userId: 1, createdAt: -1 });
aiInteractionSchema.index({ feature: 1, createdAt: -1 });
aiInteractionSchema.index({ conversationId: 1, createdAt: 1 });

const AIInteraction = mongoose.model<IAIInteraction>("AIInteraction", aiInteractionSchema);

export default AIInteraction;