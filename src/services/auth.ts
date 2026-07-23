import crypto from "crypto";
import User, { IUser } from "../models/mongoose/User";
import { AppError } from "../utils/AppError";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/token";
import { config } from "../config";
import { sendOtpEmail, sendWelcomeEmail } from "./email";
import * as workspaceService from "./workspace";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email already in use", 409);
  }

  const user = await User.create({ name, email, password });

  const otp = generateOtp();
  user.emailOtp = crypto.createHash("sha256").update(otp).digest("hex");
  user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpEmail(user.email, user.name, otp);

  return {
    message: "Verification code sent to email",
    email: user.email,
  };
}

export async function resendOtp(email: string) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email already verified", 400);
  }

  const otp = generateOtp();
  user.emailOtp = crypto.createHash("sha256").update(otp).digest("hex");
  user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpEmail(user.email, user.name, otp);

  return { message: "New verification code sent to email" };
}

export async function verifyEmail(email: string, code: string) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email already verified", 400);
  }

  if (!user.emailOtp || !user.emailOtpExpires) {
    throw new AppError("No verification code found. Please request a new one.", 400);
  }

  if (user.emailOtpExpires < new Date()) {
    throw new AppError("Verification code has expired. Please request a new one.", 400);
  }

  const hashedCode = crypto.createHash("sha256").update(code).digest("hex");
  if (hashedCode !== user.emailOtp) {
    throw new AppError("Invalid verification code", 400);
  }

  user.isEmailVerified = true;
  user.emailOtp = undefined;
  user.emailOtpExpires = undefined;

  const userId = user._id.toString();
  const payload = { userId, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  await sendWelcomeEmail(user.email, user.name);

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isEmailVerified) {
    const otp = generateOtp();
    user.emailOtp = crypto.createHash("sha256").update(otp).digest("hex");
    user.emailOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtpEmail(user.email, user.name, otp);

    throw new AppError("Please verify your email first. A new code has been sent.", 403);
  }

  const userId = user._id.toString();
  const payload = { userId, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError("Invalid refresh token", 401);
    }

    const userId = user._id.toString();
    const payload = { userId, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    user.refreshToken = newRefreshToken;
    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Invalid refresh token", 401);
  }
}

export async function logoutUser(userId: string) {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
}

export async function getProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return sanitizeUser(user);
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; avatar?: string }
) {
  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return sanitizeUser(user);
}

export async function submitOnboarding(
  userId: string,
  data: {
    role: string;
    teamSize: string;
    useCase: string;
    selectedTemplate?: string;
  }
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const existingWorkspaces = await workspaceService.getUserWorkspaces(userId);
  let workspace;
  if (existingWorkspaces.length === 0) {
    workspace = await workspaceService.createWorkspace({
      name: `${user.name}'s Workspace`,
      description: `Personal workspace for ${user.name}`,
      ownerId: userId,
    });
  } else {
    workspace = existingWorkspaces[0];
  }

  return {
    message: "Onboarding completed",
    redirect: data.selectedTemplate === "blank" ? "/dashboard" : `/w/${workspace.id}`,
  };
}

export async function handleOAuthLogin(provider: string, code: string) {
  if (provider === "google") {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.oauth.googleClientId,
        client_secret: config.oauth.googleClientSecret,
        redirect_uri: `${config.clientUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData: any = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new AppError("Failed to authenticate with Google", 401);
    }

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const profile: any = await profileResponse.json();

    let user = await User.findOne({ email: profile.email });
    if (!user) {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        avatar: profile.picture,
        password: crypto.randomBytes(32).toString("hex"),
        isEmailVerified: true,
      });
    }

    const userId = user._id.toString();
    const payload = { userId, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save();

    return { user: sanitizeUser(user), accessToken, refreshToken };
  }

  if (provider === "github") {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code,
          client_id: config.oauth.githubClientId,
          client_secret: config.oauth.githubClientSecret,
        }),
      }
    );

    const tokenData: any = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new AppError("Failed to authenticate with GitHub", 401);
    }

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile: any = await profileResponse.json();

    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails: { primary?: boolean; email?: string }[] = await emailResponse.json() as any;
    const primaryEmail = emails.find((e) => e.primary)?.email || (profile as any).email || "";

    let user = await User.findOne({ email: primaryEmail });
    if (!user) {
      user = await User.create({
        name: profile.name || profile.login || "",
        email: primaryEmail,
        avatar: profile.avatar_url,
        password: crypto.randomBytes(32).toString("hex"),
        isEmailVerified: true,
      });
    }

    const userId = user._id.toString();
    const payload = { userId, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save();

    return { user: sanitizeUser(user), accessToken, refreshToken };
  }

  throw new AppError(`Unsupported OAuth provider: ${provider}`, 400);
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email });
  if (!user) {
    return { message: "If this email exists, a reset link has been sent." };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.set("resetPasswordToken", resetTokenHash);
  user.set("resetPasswordExpires", new Date(Date.now() + 3600000));

  const userAny = user as any;
  userAny.resetPasswordToken = resetTokenHash;
  userAny.resetPasswordExpires = new Date(Date.now() + 3600000);
  await user.save();

  return {
    message: "If this email exists, a reset link has been sent.",
    resetToken,
  };
}

export async function resetPassword(token: string, newPassword: string) {
  const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: resetTokenHash,
    resetPasswordExpires: { $gt: new Date() },
  } as any);

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.password = newPassword;
  const userAny = user as any;
  userAny.resetPasswordToken = undefined;
  userAny.resetPasswordExpires = undefined;
  (user as any).refreshToken = null;
  await user.save();

  return { message: "Password has been reset successfully" };
}

function sanitizeUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}
