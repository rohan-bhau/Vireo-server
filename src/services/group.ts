import Group from "../models/mongoose/Group";
import { AppError } from "../utils/AppError";

export async function getGroups(workspaceId: string) {
  return Group.find({ workspaceId }).sort({ name: 1 });
}

export async function getGroupById(id: string) {
  const group = await Group.findById(id);
  if (!group) throw new AppError("Group not found", 404);
  return group;
}

export async function createGroup(data: {
  name: string;
  description?: string;
  workspaceId: string;
  createdBy: string;
}) {
  const existing = await Group.findOne({ workspaceId: data.workspaceId, name: data.name });
  if (existing) throw new AppError("A group with this name already exists", 409);
  return Group.create({ ...data, members: [] });
}

export async function updateGroup(id: string, data: { name?: string; description?: string }) {
  const group = await Group.findById(id);
  if (!group) throw new AppError("Group not found", 404);
  if (data.name && data.name !== group.name) {
    const dup = await Group.findOne({ workspaceId: group.workspaceId, name: data.name });
    if (dup) throw new AppError("A group with this name already exists", 409);
  }
  Object.assign(group, data);
  return group.save();
}

export async function deleteGroup(id: string) {
  const group = await Group.findById(id);
  if (!group) throw new AppError("Group not found", 404);
  await Group.findByIdAndDelete(id);
}

export async function addMemberToGroup(groupId: string, userId: string) {
  const group = await Group.findById(groupId);
  if (!group) throw new AppError("Group not found", 404);
  if (group.members.some((m) => m.userId === userId)) {
    throw new AppError("User is already a member of this group", 409);
  }
  group.members.push({ userId, addedAt: new Date() });
  return group.save();
}

export async function removeMemberFromGroup(groupId: string, userId: string) {
  const group = await Group.findById(groupId);
  if (!group) throw new AppError("Group not found", 404);
  group.members = group.members.filter((m) => m.userId !== userId);
  return group.save();
}

export async function getAllGroupsForAdmin() {
  return Group.find().sort({ workspaceId: 1, name: 1 }).lean();
}
