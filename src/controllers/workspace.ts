import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as workspaceService from "../services/workspace";
import * as cloudinaryService from "../services/cloudinary";

export async function uploadAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ status: "error", message: "No file uploaded" });
      return;
    }
    if (!cloudinaryService.isCloudinaryConfigured()) {
      res.status(400).json({ status: "error", message: "File uploads are not configured" });
      return;
    }
    if (!file.mimetype.startsWith("image/")) {
      res.status(400).json({ status: "error", message: "Only image files are allowed" });
      return;
    }
    const { url } = await cloudinaryService.uploadWorkspaceAvatar(
      file.buffer,
      file.originalname,
      workspaceId
    );
    const workspace = await workspaceService.updateWorkspace(workspaceId, { avatar: url });
    res.status(200).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { name, description, template, avatar } = req.body;
    const workspace = await workspaceService.createWorkspace({
      name,
      description,
      ownerId: req.userId!,
      template,
      avatar,
    });
    res.status(201).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const workspace = await workspaceService.getWorkspaceById(workspaceId);
    res.status(200).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function getMyWorkspaces(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaces = await workspaceService.getUserWorkspaces(req.userId!);
    res.status(200).json({ status: "success", data: { workspaces } });
  } catch (error) {
    next(error);
  }
}

export async function ensureDefaultProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const project = await workspaceService.getOrSeedDefaultProject(workspaceId);
    res.status(200).json({ status: "success", data: { project } });
  } catch (error) {
    next(error);
  }
}

export async function update(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { name, description, template, avatar } = req.body;
    const workspace = await workspaceService.updateWorkspace(
      workspaceId,
      { name, description, template, avatar }
    );
    res.status(200).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}

export async function remove(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    await workspaceService.deleteWorkspace(workspaceId, req.userId);
    res.status(200).json({ status: "success", message: "Workspace deleted" });
  } catch (error) {
    next(error);
  }
}

export async function getMembers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const members = await workspaceService.getWorkspaceMembers(workspaceId);
    res.status(200).json({ status: "success", data: { members } });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.params.userId as string;
    await workspaceService.removeMember(workspaceId, userId, req.userId);
    res.status(200).json({ status: "success", message: "Member removed" });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.params.userId as string;
    const { role } = req.body;
    if (!["ADMIN", "EDIT", "VIEW"].includes(role)) {
      res.status(400).json({ status: "fail", message: "Invalid role" });
      return;
    }
    const member = await workspaceService.updateMemberRole(
      workspaceId,
      userId,
      role,
      req.userId!
    );
    res.status(200).json({ status: "success", data: { member } });
  } catch (error) {
    next(error);
  }
}

export async function transferOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ status: "fail", message: "userId is required" });
      return;
    }
    const workspace = await workspaceService.transferOwnership(
      workspaceId,
      userId,
      req.userId!
    );
    res.status(200).json({ status: "success", data: { workspace } });
  } catch (error) {
    next(error);
  }
}
