import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as projectController from "../controllers/project";
import * as boardController from "../controllers/board";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

const router = Router({ mergeParams: true });

router.use(authenticate);

// Get project by ID without requiring workspaceId in URL
router.get("/:projectId", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        boards: {
          include: { columns: { orderBy: { position: "asc" } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    res.status(200).json({ status: "success", data: { project } });
  } catch (error) {
    next(error);
  }
});

// Get boards for a project
router.get("/:projectId/boards", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const boards = await prisma.board.findMany({
      where: { projectId: req.params.projectId },
      include: { columns: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ status: "success", data: { boards } });
  } catch (error) {
    next(error);
  }
});

export default router;
