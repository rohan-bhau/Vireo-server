import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as groupService from "../services/group";

export async function getGroups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const groups = await groupService.getGroups(workspaceId);
    res.json({ status: "success", data: { groups } });
  } catch (error) { next(error); }
}

export async function createGroup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const group = await groupService.createGroup({
      ...req.body,
      workspaceId: req.params.workspaceId,
      createdBy: req.userId!,
    });
    res.status(201).json({ status: "success", data: { group } });
  } catch (error) { next(error); }
}

export async function updateGroup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const group = await groupService.updateGroup(id, req.body);
    res.json({ status: "success", data: { group } });
  } catch (error) { next(error); }
}

export async function deleteGroup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await groupService.deleteGroup(id);
    res.json({ status: "success", message: "Group deleted" });
  } catch (error) { next(error); }
}

export async function addMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groupId = req.params.groupId as string;
    const group = await groupService.addMemberToGroup(groupId, req.body.userId);
    res.json({ status: "success", data: { group } });
  } catch (error) { next(error); }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groupId = req.params.groupId as string;
    const userId = req.params.userId as string;
    const group = await groupService.removeMemberFromGroup(groupId, userId);
    res.json({ status: "success", data: { group } });
  } catch (error) { next(error); }
}

export async function getAllGroups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groups = await groupService.getAllGroupsForAdmin();
    res.json({ status: "success", data: { groups } });
  } catch (error) { next(error); }
}
