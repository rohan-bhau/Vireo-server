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

export async function updateBoard(boardId: string, name: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });

  if (!board) {
    throw new AppError("Board not found", 404);
  }

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { name },
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
  position?: number
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
    data: { name, position: nextPosition, boardId },
  });

  return column;
}

export async function updateColumn(
  columnId: string,
  data: { name?: string; position?: number }
) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });

  if (!column) {
    throw new AppError("Column not found", 404);
  }

  const updated = await prisma.column.update({
    where: { id: columnId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.position !== undefined && { position: data.position }),
    },
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

  const updates = columnIds.map((id, index) =>
    prisma.column.update({
      where: { id },
      data: { position: index },
    })
  );

  await prisma.$transaction(updates);

  return prisma.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
  });
}
