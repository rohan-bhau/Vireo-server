import { Router, Response, NextFunction } from "express";
import * as sprintController from "../controllers/sprint";
import { authenticate, AuthRequest } from "../middleware/auth";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

const router = Router({ mergeParams: true });

router.use(authenticate);

async function requireProjectMember(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const projectId = (req.params.projectId || req.body.projectId) as string;
    if (!projectId) throw new AppError("Project ID is required", 400);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError("Project not found", 404);

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.userId! } },
    });
    if (!member) throw new AppError("You are not a member of this workspace", 403);
    req.workspaceRole = member.role;
    next();
  } catch (error) {
    next(error);
  }
}

async function requireSprintMember(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const sprintId = req.params.sprintId as string;
    if (!sprintId) throw new AppError("Sprint ID is required", 400);

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    });
    if (!sprint) throw new AppError("Sprint not found", 404);

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: sprint.project.workspaceId, userId: req.userId! } },
    });
    if (!member) throw new AppError("You are not a member of this workspace", 403);
    req.workspaceRole = member.role;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.workspaceRole !== "ADMIN") {
    return next(new AppError("You do not have permission to perform this action", 403));
  }
  next();
}

router.get("/project/:projectId", requireProjectMember, sprintController.getByProject);
router.get("/project/:projectId/backlog", requireProjectMember, sprintController.getBacklog);

router.get("/:sprintId", requireSprintMember, sprintController.getById);
router.get("/:sprintId/tasks", requireSprintMember, sprintController.getTasks);

router.post("/", requireProjectMember, requireAdmin, sprintController.create);
router.post("/:sprintId/start", requireSprintMember, requireAdmin, sprintController.start);
router.post("/:sprintId/complete", requireSprintMember, requireAdmin, sprintController.complete);
router.post("/:sprintId/assign-tasks", requireSprintMember, requireAdmin, sprintController.assignTasks);
router.post("/:sprintId/remove-tasks", requireSprintMember, requireAdmin, sprintController.removeTasks);

router.put("/:sprintId", requireSprintMember, requireAdmin, sprintController.update);

router.delete("/:sprintId", requireSprintMember, requireAdmin, sprintController.remove);

export default router;
