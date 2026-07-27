import NotificationScheme, {
  INotificationScheme,
  NotificationEvent,
  RecipientType,
} from "../models/mongoose/NotificationScheme";
import { AppError } from "../utils/AppError";

interface CreateSchemeInput {
  name: string;
  workspaceId: string;
  description?: string;
  events?: { event: NotificationEvent; recipients: RecipientType[]; email: boolean; inApp: boolean }[];
}

const DEFAULT_EVENTS: { event: NotificationEvent; recipients: RecipientType[]; email: boolean; inApp: boolean }[] = [
  { event: "issue_created", recipients: ["reporter", "project_lead"], email: false, inApp: true },
  { event: "issue_assigned", recipients: ["assignee", "reporter"], email: true, inApp: true },
  { event: "issue_commented", recipients: ["reporter", "assignee", "watchers"], email: false, inApp: true },
  { event: "issue_transitioned", recipients: ["assignee", "reporter", "watchers"], email: false, inApp: true },
  { event: "issue_updated", recipients: ["reporter", "assignee", "watchers"], email: false, inApp: true },
  { event: "issue_deleted", recipients: ["reporter", "project_lead"], email: false, inApp: true },
  { event: "mentioned", recipients: ["watchers"], email: true, inApp: true },
  { event: "sprint_started", recipients: ["all_project_members"], email: false, inApp: true },
  { event: "sprint_completed", recipients: ["all_project_members"], email: false, inApp: true },
];

export async function createScheme(input: CreateSchemeInput) {
  const existing = await NotificationScheme.findOne({
    workspaceId: input.workspaceId,
    name: input.name,
  });
  if (existing) throw new AppError("A scheme with this name already exists in this workspace", 409);

  return NotificationScheme.create({
    name: input.name,
    workspaceId: input.workspaceId,
    description: input.description || "",
    events: input.events || DEFAULT_EVENTS,
  });
}

export async function getWorkspaceSchemes(workspaceId: string) {
  return NotificationScheme.find({ workspaceId }).sort({ default: -1, name: 1 });
}

export async function getSchemeById(id: string) {
  const scheme = await NotificationScheme.findById(id);
  if (!scheme) throw new AppError("Notification scheme not found", 404);
  return scheme;
}

export async function updateScheme(id: string, input: Partial<CreateSchemeInput>) {
  const scheme = await NotificationScheme.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  });
  if (!scheme) throw new AppError("Notification scheme not found", 404);
  return scheme;
}

export async function deleteScheme(id: string) {
  const scheme = await NotificationScheme.findByIdAndDelete(id);
  if (!scheme) throw new AppError("Notification scheme not found", 404);
}

export async function getDefaultScheme(workspaceId: string) {
  let scheme = await NotificationScheme.findOne({ workspaceId, default: true });
  if (!scheme) {
    scheme = await NotificationScheme.findOne({ workspaceId });
  }
  if (!scheme) {
    scheme = await NotificationScheme.findOne({ workspaceId: "__global__" });
    if (!scheme) {
      scheme = await NotificationScheme.create({
        name: "Default",
        workspaceId,
        description: "Default notification scheme",
        default: true,
        events: DEFAULT_EVENTS,
      });
    }
  }
  return scheme;
}

export function getRecipientsForEvent(
  scheme: INotificationScheme,
  event: NotificationEvent,
  context: {
    reporter?: string | null;
    assignee?: string | null;
    watchers?: string[];
    projectLead?: string | null;
    allProjectMembers?: string[];
    customRoleMembers?: string[];
  }
): { userIds: string[]; sendEmail: boolean; sendInApp: boolean } {
  const eventConfig = scheme.events.find((e) => e.event === event);
  if (!eventConfig || !eventConfig.inApp) return { userIds: [], sendEmail: false, sendInApp: false };

  const userIds = new Set<string>();

  for (const recipient of eventConfig.recipients) {
    switch (recipient) {
      case "reporter":
        if (context.reporter) userIds.add(context.reporter);
        break;
      case "assignee":
        if (context.assignee) userIds.add(context.assignee);
        break;
      case "watchers":
        context.watchers?.forEach((id) => userIds.add(id));
        break;
      case "project_lead":
        if (context.projectLead) userIds.add(context.projectLead);
        break;
      case "all_project_members":
        context.allProjectMembers?.forEach((id) => userIds.add(id));
        break;
      case "custom_role":
        context.customRoleMembers?.forEach((id) => userIds.add(id));
        break;
    }
  }

  return {
    userIds: Array.from(userIds),
    sendEmail: eventConfig.email,
    sendInApp: true,
  };
}
