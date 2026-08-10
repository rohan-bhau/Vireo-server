import mongoose, { Schema } from "mongoose";

export type CustomFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTISELECT";

export interface ICustomField {
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  order: number;
}

const customFieldSchema = new Schema<ICustomField>(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "MULTISELECT"],
      default: "TEXT",
    },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

customFieldSchema.index({ workspaceId: 1, order: 1 });

const CustomField = mongoose.model<ICustomField>("CustomField", customFieldSchema);

export default CustomField;