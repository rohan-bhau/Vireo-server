import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as versionService from "../services/version";

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const versions = await versionService.getProjectVersions(projectId);
    res.status(200).json({ status: "success", data: { versions } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const version = await versionService.getVersionById(id);
    res.status(200).json({ status: "success", data: { version } });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const version = await versionService.createVersion({
      ...req.body,
      actorId: req.userId!,
    });
    res.status(201).json({ status: "success", data: { version } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const version = await versionService.updateVersion(id, req.body, req.userId!);
    res.status(200).json({ status: "success", data: { version } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await versionService.deleteVersion(id, req.userId!);
    res.status(200).json({ status: "success", message: "Version deleted" });
  } catch (error) {
    next(error);
  }
}

export async function release(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const version = await versionService.releaseVersion(id, req.userId!);
    res.status(200).json({ status: "success", data: { version } });
  } catch (error) {
    next(error);
  }
}

export async function getProgress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const progress = await versionService.getVersionProgress(id);
    res.status(200).json({ status: "success", data: { progress } });
  } catch (error) {
    next(error);
  }
}
