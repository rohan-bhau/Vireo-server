import mongoose, { Document, Schema } from "mongoose";

export type VersionStatus = "unreleased" | "released" | "archived";

export interface IVersion {
  name: string;
  description?: string;
  projectId: string;
  startDate?: Date | null;
  releaseDate?: Date | null;
  status: VersionStatus;
  released: boolean;
}

const versionSchema = new Schema<IVersion>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    projectId: { type: String, required: true },
    startDate: { type: Date, default: null },
    releaseDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["unreleased", "released", "archived"],
      default: "unreleased",
    },
    released: { type: Boolean, default: false },
  },
  { timestamps: true }
);

versionSchema.index({ projectId: 1, name: 1 }, { unique: true });

const Version = mongoose.model<IVersion>("Version", versionSchema);

export default Version;
