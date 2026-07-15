import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as invitationService from "../services/invitation";

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { inviteeEmail, role } = req.body;
    const workspaceId = req.params.workspaceId as string;
    const invitation = await invitationService.createInvitation({
      workspaceId,
      inviterId: req.userId!,
      inviteeEmail,
      role: role || "MEMBER",
    });
    res.status(201).json({ status: "success", data: { invitation } });
  } catch (error) {
    next(error);
  }
}

export async function getWorkspaceInvitations(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId as string;
    const invitations = await invitationService.getWorkspaceInvitations(
      workspaceId
    );
    res.status(200).json({ status: "success", data: { invitations } });
  } catch (error) {
    next(error);
  }
}

export async function accept(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.params.token as string;
    await invitationService.acceptInvitation(token, req.userId!);
    res.status(200).json({ status: "success", message: "Invitation accepted" });
  } catch (error) {
    next(error);
  }
}

export async function decline(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.params.token as string;
    await invitationService.declineInvitation(token);
    res.status(200).json({ status: "success", message: "Invitation declined" });
  } catch (error) {
    next(error);
  }
}

export async function cancel(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const invitationId = req.params.invitationId as string;
    await invitationService.cancelInvitation(invitationId);
    res.status(200).json({ status: "success", message: "Invitation cancelled" });
  } catch (error) {
    next(error);
  }
}

export async function getMyInvitations(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const invitations = await invitationService.getPendingInvitationsForUser(
      req.userEmail!
    );
    res.status(200).json({ status: "success", data: { invitations } });
  } catch (error) {
    next(error);
  }
}
