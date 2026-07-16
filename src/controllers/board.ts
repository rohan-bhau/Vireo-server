import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import * as boardService from "../services/board";

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const boardId = req.params.boardId as string;
    const board = await boardService.getBoardById(boardId);
    res.status(200).json({ status: "success", data: { board } });
  } catch (error) {
    next(error);
  }
}

export async function getByProject(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = req.params.projectId as string;
    const boards = await boardService.getProjectBoards(projectId);
    res.status(200).json({ status: "success", data: { boards } });
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
    const projectId = req.params.projectId as string;
    const { name } = req.body;
    const board = await boardService.createBoard(projectId, name);
    res.status(201).json({ status: "success", data: { board } });
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
    const boardId = req.params.boardId as string;
    const { name } = req.body;
    const board = await boardService.updateBoard(boardId, name);
    res.status(200).json({ status: "success", data: { board } });
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
    const boardId = req.params.boardId as string;
    await boardService.deleteBoard(boardId);
    res.status(200).json({ status: "success", message: "Board deleted" });
  } catch (error) {
    next(error);
  }
}

export async function addColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const boardId = req.params.boardId as string;
    const { name, position } = req.body;
    const column = await boardService.addColumn(boardId, name, position);
    res.status(201).json({ status: "success", data: { column } });
  } catch (error) {
    next(error);
  }
}

export async function updateColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const columnId = req.params.columnId as string;
    const { name, position } = req.body;
    const column = await boardService.updateColumn(columnId, { name, position });
    res.status(200).json({ status: "success", data: { column } });
  } catch (error) {
    next(error);
  }
}

export async function removeColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const columnId = req.params.columnId as string;
    await boardService.deleteColumn(columnId);
    res.status(200).json({ status: "success", message: "Column deleted" });
  } catch (error) {
    next(error);
  }
}

export async function reorderColumns(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const boardId = req.params.boardId as string;
    const { columnIds } = req.body;
    const columns = await boardService.reorderColumns(boardId, columnIds);
    res.status(200).json({ status: "success", data: { columns } });
  } catch (error) {
    next(error);
  }
}
