import { Router, Response, NextFunction } from "express";
import * as epicController from "../controllers/epic";
import { authenticate, AuthRequest } from "../middleware/auth";
import Epic from "../models/mongoose/Epic";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

const router = Router({ mergeParams: true });

router.use(authenticate);

async function resolveProjectMember(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
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

async function resolveEpicMember(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const epicKey = req.params.epicKey as string;
    if (!epicKey) throw new AppError("Epic key is required", 400);

    const epic = await Epic.findOne({ epicKey });
    if (!epic) throw new AppError("Epic not found", 404);

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: epic.workspaceId, userId: req.userId! } },
    });
    if (!member) throw new AppError("You are not a member of this workspace", 403);
    req.workspaceRole = member.role;
    next();
  } catch (error) {
    next(error);
  }
}

async function resolveWorkspaceMember(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const workspaceId = (req.params.workspaceId || req.body.workspaceId) as string;
    if (!workspaceId) throw new AppError("Workspace ID is required", 400);

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.userId! } },
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

router.get("/project/:projectId", resolveProjectMember, epicController.getByProject);
router.get("/workspace/:workspaceId", resolveWorkspaceMember, epicController.getByWorkspace);
router.get("/:epicKey", epicController.getByKey);

router.post("/", resolveWorkspaceMember, requireAdmin, epicController.create);

router.put("/:epicKey", resolveEpicMember, requireAdmin, epicController.update);
router.delete("/:epicKey", resolveEpicMember, requireAdmin, epicController.remove);

export default router;
