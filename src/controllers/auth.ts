import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as authService from "../services/auth";
import { config } from "../config";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, email, password } = req.body;
    const result = await authService.registerUser(name, email, password);
    res.status(201).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ status: "error", message: "Refresh token is required" });
      return;
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    await authService.logoutUser(req.userId!);
    res.status(200).json({ status: "success", message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ status: "error", message: "Email and code are required" });
      return;
    }
    const result = await authService.verifyEmail(email, code);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function resendOtp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ status: "error", message: "Email is required" });
      return;
    }
    const result = await authService.resendOtp(email);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function onboarding(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { role, teamSize, useCase, selectedTemplate } = req.body;
    const result = await authService.submitOnboarding(req.userId!, {
      role, teamSize, useCase, selectedTemplate,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function oauthRedirect(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { provider } = req.params;
    if (provider === "google") {
      const redirectUri = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.oauth.googleClientId}&redirect_uri=${config.clientUrl}/api/auth/google/callback&response_type=code&scope=email%20profile`;
      res.redirect(redirectUri);
    } else if (provider === "github") {
      const redirectUri = `https://github.com/login/oauth/authorize?client_id=${config.oauth.githubClientId}&redirect_uri=${config.clientUrl}/api/auth/github/callback&scope=user:email`;
      res.redirect(redirectUri);
    } else {
      res.status(400).json({ status: "error", message: `Unsupported provider: ${provider}` });
    }
  } catch (error) {
    next(error);
  }
}

export async function oauthCallback(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const provider = req.params.provider;
    const codeParam = req.query.code;
    const providerStr = typeof provider === "string" ? provider : "";
    const code = typeof codeParam === "string" ? codeParam : undefined;
    if (!code) {
      res.status(400).json({ status: "error", message: "Authorization code is required" });
      return;
    }
    const result = await authService.handleOAuthLogin(providerStr, code);
    const redirectUrl = `${config.clientUrl}/oauth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ status: "error", message: "Token and password are required" });
      return;
    }
    const result = await authService.resetPassword(token, password);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}
