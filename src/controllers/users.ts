import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as authService from "../services/auth";

export async function getProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authService.getProfile(req.userId!);
    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, avatar } = req.body;
    const user = await authService.updateProfile(req.userId!, { name, avatar });
    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
}
