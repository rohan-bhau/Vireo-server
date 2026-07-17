import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as savedFilterService from "../services/savedFilter";

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filter = await savedFilterService.createSavedFilter({
      ...req.body,
      userId: req.userId!,
    });
    res.status(201).json({ status: "success", data: { filter } });
  } catch (error) {
    next(error);
  }
}

export async function getMyFilters(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const filters = await savedFilterService.getUserFilters(req.userId!, workspaceId);
    res.status(200).json({ status: "success", data: { filters } });
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const filter = await savedFilterService.getFilterById(id);
    res.status(200).json({ status: "success", data: { filter } });
  } catch (error) {
    next(error);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const filter = await savedFilterService.updateFilter(id, req.body);
    res.status(200).json({ status: "success", data: { filter } });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await savedFilterService.deleteFilter(id);
    res.status(200).json({ status: "success", message: "Filter deleted" });
  } catch (error) {
    next(error);
  }
}
