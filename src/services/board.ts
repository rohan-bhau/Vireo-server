import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

export async function getBoardById(boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  return board;
}

export async function getProjectBoards(projectId: string) {
  const boards = await prisma.board.findMany({
    where: { projectId },
    include: { columns: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return boards;
}

export async function createBoard(projectId: string, name: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  const board = await prisma.board.create({
    data: {
      name,
      projectId,
      columns: {
        create: [
          { name: "To Do", position: 0 },
          { name: "In Progress", position: 1 },
          { name: "Done", position: 2 },
        ],
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  return board;
}

export async function updateBoard(boardId: string, name?: string, config?: any) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (config !== undefined) data.config = config;

  const updated = await prisma.board.update({
    where: { id: boardId },
    data,
    include: { columns: { orderBy: { position: "asc" } } },
  });

  return updated;
}

export async function updateBoardConfig(boardId: string, config: any) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  const existing = (board as any).config || {};
  const merged = { ...(typeof existing === "object" ? existing : {}), ...config };

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { config: merged },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  return updated;
}

export async function deleteBoard(boardId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  await prisma.board.delete({ where: { id: boardId } });
}

export async function addColumn(
  boardId: string,
  name: string,
  position?: number,
  wipLimit?: number
) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { columns: { orderBy: { position: "asc" } } },
  });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  const nextPosition = position ?? board.columns.length;

  const column = await prisma.column.create({
    data: { name, position: nextPosition, boardId, wipLimit },
  });

  return column;
}

export async function updateColumn(
  columnId: string,
  data: { name?: string; position?: number; wipLimit?: number | null }
) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });

  if (!column) {
    throw new AppError("Column not found", 404);
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.wipLimit !== undefined) updateData.wipLimit = data.wipLimit;

  const updated = await prisma.column.update({
    where: { id: columnId },
    data: updateData,
  });

  return updated;
}

export async function deleteColumn(columnId: string) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });

  if (!column) {
    throw new AppError("Column not found", 404);
  }

  await prisma.column.delete({ where: { id: columnId } });
}

export async function reorderColumns(
  boardId: string,
  columnIds: string[]
) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  // Two-phase update to avoid unique constraint violations during position swaps
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < columnIds.length; i++) {
      await tx.column.update({
        where: { id: columnIds[i] },
        data: { position: -(i + 1) },
      });
    }
    for (let i = 0; i < columnIds.length; i++) {
      await tx.column.update({
        where: { id: columnIds[i] },
        data: { position: i },
      });
    }
  });

  return prisma.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
  });
}
