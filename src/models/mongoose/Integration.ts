import mongoose, { Document, Schema } from "mongoose";

export type IntegrationType = "slack" | "github";

export interface IIntegration extends Document {
  workspaceId: string;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configuredBy: string;
  lastTestedAt: Date | null;
  lastTestStatus: "success" | "failure" | null;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IIntegration>(
  {
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["slack", "github"],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    configuredBy: {
      type: String,
      required: true,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    lastTestStatus: {
      type: String,
      enum: ["success", "failure", null],
      default: null,
    },
  },
  { timestamps: true }
);

integrationSchema.index({ workspaceId: 1, type: 1 }, { unique: true });

const Integration = mongoose.model<IIntegration>("Integration", integrationSchema);

export default Integration;
