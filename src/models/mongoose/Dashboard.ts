import mongoose, { Schema, Document } from "mongoose";

export interface IGadgetConfig {
  gadgetId: string;
  type: string;
  title: string;
  filterId?: string;
  timeRange?: string;
  refreshInterval?: number;
  displayOptions?: Record<string, unknown>;
  position: number;
  width: 1 | 2 | 3;
  height: 1 | 2;
}

export interface IDashboard extends Document {
  name: string;
  description?: string;
  workspaceId: string;
  ownerId: string;
  shared: boolean;
  sharedWith: string[];
  columnCount: 2 | 3;
  gadgets: IGadgetConfig[];
  createdAt: Date;
  updatedAt: Date;
}

const GadgetConfigSchema = new Schema<IGadgetConfig>({
  gadgetId: { type: String, required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  filterId: { type: String },
  timeRange: { type: String },
  refreshInterval: { type: Number, default: 0 },
  displayOptions: { type: Schema.Types.Mixed },
  position: { type: Number, required: true },
  width: { type: Number, enum: [1, 2, 3], default: 1 },
  height: { type: Number, enum: [1, 2], default: 1 },
});

const DashboardSchema = new Schema<IDashboard>(
  {
    name: { type: String, required: true },
    description: { type: String },
    workspaceId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    shared: { type: Boolean, default: false },
    sharedWith: [{ type: String }],
    columnCount: { type: Number, enum: [2, 3], default: 2 },
    gadgets: [GadgetConfigSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IDashboard>("Dashboard", DashboardSchema);
