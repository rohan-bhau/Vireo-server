import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { AIFeatureType } from "../models/mongoose/AIInteraction";
import * as aiService from "../services/ai";

export async function generateTicketDraft(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, type, projectId } = req.body;
    const result = await aiService.generateTicketDraft(title, type, projectId, req.userId!);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function summarizeThread(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const taskKey = req.params.taskKey as string;
    const result = await aiService.summarizeThread(taskKey, req.userId!);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function smartTriage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { taskTitle, taskDescription, workspaceId } = req.body;
    const result = await aiService.smartTriage(taskTitle, taskDescription, workspaceId, req.userId!);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function suggestSprintPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { projectId, sprintName, sprintCapacity } = req.body;
    const result = await aiService.suggestSprintPlan(projectId, sprintName, sprintCapacity, req.userId!);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function chatWithAI(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { message, context } = req.body;
    const result = await aiService.chatWithAI(message, context || {}, req.userId!);
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAIHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { feature, limit } = req.query;
    const history = await aiService.getAIHistory(
      req.userId!,
      (feature as AIFeatureType) || undefined,
      limit ? parseInt(limit as string, 10) : 20
    );
    res.status(200).json({ status: "success", data: { history } });
  } catch (error) {
    next(error);
  }
}