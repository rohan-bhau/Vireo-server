import mongoose, { Document, Schema } from "mongoose";

export interface IComponent {
  name: string;
  description?: string;
  projectId: string;
  lead?: string | null;
  defaultAssignee?: string | null;
}

const componentSchema = new Schema<IComponent>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    projectId: { type: String, required: true },
    lead: { type: String, default: null },
    defaultAssignee: { type: String, default: null },
  },
  { timestamps: true }
);

componentSchema.index({ projectId: 1, name: 1 }, { unique: true });

const Component = mongoose.model<IComponent>("Component", componentSchema);

export default Component;
