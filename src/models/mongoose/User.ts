import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface INotificationPreferences {
  email: boolean;
  push: boolean;
  onAssigned: boolean;
  onMentioned: boolean;
  onStatusChange: boolean;
  onCommented: boolean;
  onIssueCreated: boolean;
  onSprintEvents: boolean;
}

export interface IProjectNotificationOverride {
  projectId: string;
  email: boolean;
  onAssigned: boolean;
  onMentioned: boolean;
  onStatusChange: boolean;
  onCommented: boolean;
  onIssueCreated: boolean;
  onSprintEvents: boolean;
}

export interface IOnboarding {
  role?: string;
  companySize?: string;
  useCase?: string;
  template?: string;
  workspaceName?: string;
  step: string;
  completedAt?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  role: "user" | "admin";
  refreshToken?: string;
  stripeCustomerId?: string;
  emailOtp?: string;
  emailOtpExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  isEmailVerified: boolean;
  lastSeen?: Date;
  onboarding?: IOnboarding;
  notificationPreferences?: INotificationPreferences;
  projectNotificationOverrides?: IProjectNotificationOverride[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const onboardingSchema = new Schema<IOnboarding>(
  {
    role: { type: String },
    companySize: { type: String },
    useCase: { type: String },
    template: { type: String },
    workspaceName: { type: String },
    step: { type: String, default: "role" },
    completedAt: { type: Date },
  },
  { _id: false }
);

const notificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    onAssigned: { type: Boolean, default: true },
    onMentioned: { type: Boolean, default: true },
    onStatusChange: { type: Boolean, default: true },
    onCommented: { type: Boolean, default: true },
    onIssueCreated: { type: Boolean, default: true },
    onSprintEvents: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name must be at most 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    refreshToken: {
      type: String,
      select: false,
    },
    stripeCustomerId: {
      type: String,
    },
    emailOtp: {
      type: String,
    },
    emailOtpExpires: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    onboarding: {
      type: onboardingSchema,
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    projectNotificationOverrides: {
      type: [{
        projectId: { type: String, required: true },
        email: { type: Boolean, default: true },
        onAssigned: { type: Boolean, default: true },
        onMentioned: { type: Boolean, default: true },
        onStatusChange: { type: Boolean, default: true },
        onCommented: { type: Boolean, default: true },
        onIssueCreated: { type: Boolean, default: true },
        onSprintEvents: { type: Boolean, default: true },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
