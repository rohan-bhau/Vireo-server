import SavedFilter from "../models/mongoose/SavedFilter";
import { AppError } from "../utils/AppError";

interface CreateFilterInput {
  name: string;
  userId: string;
  workspaceId: string;
  projectId?: string;
  conditions: { field: string; operator: string; value: string }[];
  sortField?: string;
  sortOrder?: "asc" | "desc";
  isShared?: boolean;
}

export async function createSavedFilter(input: CreateFilterInput) {
  return SavedFilter.create(input);
}

export async function getUserFilters(userId: string, workspaceId: string) {
  return SavedFilter.find({
    $or: [
      { userId, workspaceId },
      { workspaceId, isShared: true },
    ],
  }).sort({ createdAt: -1 });
}

export async function getFilterById(id: string) {
  const filter = await SavedFilter.findById(id);
  if (!filter) throw new AppError("Saved filter not found", 404);
  return filter;
}

export async function updateFilter(id: string, input: Partial<CreateFilterInput>) {
  const filter = await SavedFilter.findById(id);
  if (!filter) throw new AppError("Saved filter not found", 404);

  if (input.name !== undefined) filter.name = input.name;
  if (input.conditions !== undefined) filter.conditions = input.conditions;
  if (input.sortField !== undefined) filter.sortField = input.sortField;
  if (input.sortOrder !== undefined) filter.sortOrder = input.sortOrder;
  if (input.isShared !== undefined) filter.isShared = input.isShared;

  return filter.save();
}

export async function deleteFilter(id: string) {
  const filter = await SavedFilter.findById(id);
  if (!filter) throw new AppError("Saved filter not found", 404);
  await SavedFilter.deleteOne({ _id: id });
}
