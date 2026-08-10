import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as customFieldService from "../services/customField";

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { workspaceId } = req.params;
    const fields = await customFieldService.listCustomFields(workspaceId as string);
    res.status(200).json({ status: "success", data: { customFields: fields } });
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
    const { workspaceId } = req.params;
    const { name, type, options, required } = req.body;
    const field = await customFieldService.createCustomField(workspaceId as string, {
      name,
      type,
      options,
      required,
    });
    res.status(201).json({ status: "success", data: { customField: field } });
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
    const { workspaceId, fieldId } = req.params;
    const { name, type, options, required } = req.body;
    const field = await customFieldService.updateCustomField(workspaceId as string, fieldId as string, {
      name,
      type,
      options,
      required,
    });
    res.status(200).json({ status: "success", data: { customField: field } });
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
    const { workspaceId, fieldId } = req.params;
    await customFieldService.deleteCustomField(workspaceId as string, fieldId as string);
    res.status(200).json({ status: "success", data: { success: true } });
  } catch (error) {
    next(error);
  }
}