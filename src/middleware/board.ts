import { Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { AuthRequest } from "./auth";

export async function requireBoardMember(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const boardId = req.params.boardId as string;
    if (!boardId) {
      throw new AppError("Board ID is required", 400);
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: { project: true },
    });

    if (!board) {
      throw new AppError("Board not found", 404);
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: board.project.workspaceId,
          userId: req.userId!,
        },
      },
    });

    if (!member) {
      throw new AppError("You are not a member of this workspace", 403);
    }

    req.workspaceRole = member.role;
    next();
  } catch (error) {
    next(error);
  }
}
