import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { AppError } from "../utils/AppError";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

export function aiRateLimiter(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  const key = req.userId || req.ip || "unknown";
  const now = Date.now();

  let record = requestCounts.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    requestCounts.set(key, record);
  }

  record.count++;

  if (record.count > MAX_REQUESTS) {
    return next(new AppError("Too many AI requests. Please try again later.", 429));
  }

  next();
}