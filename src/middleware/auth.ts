import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token";
import { AppError } from "../utils/AppError";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  workspaceRole?: "ADMIN" | "MEMBER";
}

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Access denied. No token provided.", 401));
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError("Invalid or expired token", 401));
    }
  }
}
