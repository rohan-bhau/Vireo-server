import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as componentService from "../services/component";

export async function getByProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId as string;
    const components = await componentService.getProjectComponents(projectId);
    res.status(200).json({ status: "success", data: { components } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const component = await componentService.getComponentById(id);
    res.status(200).json({ status: "success", data: { component } });
  } catch (error) {
    next(error);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const component = await componentService.createComponent({
      ...req.body,
      actorId: req.userId!,
    });
    res.status(201).json({ status: "success", data: { component } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const component = await componentService.updateComponent(id, req.body, req.userId!);
    res.status(200).json({ status: "success", data: { component } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await componentService.deleteComponent(id, req.userId!);
    res.status(200).json({ status: "success", message: "Component deleted" });
  } catch (error) {
    next(error);
  }
}
