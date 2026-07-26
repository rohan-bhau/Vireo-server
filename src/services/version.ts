import Version from "../models/mongoose/Version";
import Task from "../models/mongoose/Task";
import { AppError } from "../utils/AppError";
import { checkProjectPermission } from "./permission";

export async function getProjectVersions(projectId: string) {
  return Version.find({ projectId }).sort({ createdAt: -1 });
}

export async function getVersionById(id: string) {
  const version = await Version.findById(id);
  if (!version) throw new AppError("Version not found", 404);
  return version;
}

export async function createVersion(input: {
  name: string;
  description?: string;
  projectId: string;
  startDate?: string;
  releaseDate?: string;
  actorId: string;
}) {
  const hasPerm = await checkProjectPermission(input.actorId, input.projectId, "EDIT_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to manage versions", 403);

  const existing = await Version.findOne({ projectId: input.projectId, name: input.name });
  if (existing) throw new AppError("Version with this name already exists in this project", 409);

  return Version.create({
    name: input.name,
    description: input.description || "",
    projectId: input.projectId,
    startDate: input.startDate ? new Date(input.startDate) : null,
    releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
  });
}

export async function updateVersion(
  id: string,
  input: {
    name?: string;
    description?: string;
    startDate?: string | null;
    releaseDate?: string | null;
    status?: "unreleased" | "released" | "archived";
  },
  actorId: string
) {
  const version = await getVersionById(id);
  const hasPerm = await checkProjectPermission(actorId, version.projectId, "EDIT_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to manage versions", 403);

  if (input.name !== undefined) version.name = input.name;
  if (input.description !== undefined) version.description = input.description;
  if (input.startDate !== undefined) version.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.releaseDate !== undefined) version.releaseDate = input.releaseDate ? new Date(input.releaseDate) : null;
  if (input.status !== undefined) {
    version.status = input.status;
    version.released = input.status === "released";
  }

  return version.save();
}

export async function deleteVersion(id: string, actorId: string) {
  const version = await getVersionById(id);
  const hasPerm = await checkProjectPermission(actorId, version.projectId, "DELETE_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to delete versions", 403);

  await Version.deleteOne({ _id: id });
}

export async function releaseVersion(id: string, actorId: string) {
  const version = await getVersionById(id);
  const hasPerm = await checkProjectPermission(actorId, version.projectId, "EDIT_ISSUES");
  if (!hasPerm) throw new AppError("You do not have permission to release versions", 403);

  version.status = "released";
  version.released = true;
  version.releaseDate = new Date();
  return version.save();
}

export async function getVersionProgress(id: string) {
  const version = await getVersionById(id);

  const tasks = await Task.find({ fixVersion: version.name, projectId: version.projectId });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "in_review").length;
  const todo = tasks.filter((t) => t.status === "todo").length;

  return {
    versionId: id,
    name: version.name,
    total,
    todo,
    inProgress,
    done,
    percentDone: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
