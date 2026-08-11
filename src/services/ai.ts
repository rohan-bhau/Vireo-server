import OpenAI from "openai";
import { config } from "../config";
import AIInteraction, { AIFeatureType } from "../models/mongoose/AIInteraction";
import Task from "../models/mongoose/Task";
import Comment from "../models/mongoose/Comment";
import { prisma } from "../config/prisma";
import { tryCheckAiCallLimit, tryRecordAiCall } from "./billing";
import {
  fallbackTicketDraft,
  fallbackSummarize,
  fallbackTriage,
  fallbackSprintPlan,
  fallbackChat,
  fallbackCommentReply,
} from "./fallbackAI";

let openai: OpenAI | null = null;

try {
  if (config.llm.apiKey) {
    openai = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.apiUrl,
      timeout: 30_000,
      maxRetries: 0,
    });
  } else {
    console.warn("[AI Service] No LLM_API_KEY configured. Using fallback AI responses.");
  }
} catch (err) {
  console.warn("[AI Service] Failed to initialize OpenAI. Using fallback AI responses.");
}

/**
 * Parses an LLM response as JSON. The model is asked for JSON but may wrap
 * it in markdown code fences or add prose, so strip those before parsing.
 */
function parseJsonResponse<T>(response: string): T | null {
  if (!response) return null;
  try {
    return JSON.parse(response) as T;
  } catch {
    // Fall through to fence-stripping / extraction attempts.
  }

  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : response;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const MODEL = config.llm.model;

async function resolveWorkspaceIdFromProject(
  projectId?: string
): Promise<string | null> {
  if (!projectId) return null;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return project?.workspaceId ?? null;
}

async function resolveWorkspaceIdFromTask(
  taskKey?: string
): Promise<string | null> {
  if (!taskKey) return null;
  const task = await Task.findOne({ taskKey }).select("workspaceId").lean();
  return (task?.workspaceId as string | undefined) ?? null;
}

interface AiChatContext {
  taskKey?: string;
  workspaceId?: string;
  projectId?: string;
}

async function resolveAiWorkspaceId(context: AiChatContext): Promise<string | null> {
  if (context.workspaceId) return context.workspaceId;
  const fromTask = await resolveWorkspaceIdFromTask(context.taskKey);
  if (fromTask) return fromTask;
  return resolveWorkspaceIdFromProject(context.projectId);
}

async function recordFallbackInteraction(
  userId: string,
  feature: AIFeatureType,
  prompt: string,
  response: string,
  metadata?: Record<string, unknown>,
  conversationId?: string
) {
  await AIInteraction.create({
    userId,
    feature,
    prompt,
    response,
    model: "fallback",
    tokensUsed: 0,
    duration: 0,
    metadata: { fallback: true, ...metadata },
    conversationId,
  }).catch(() => {});
}

async function callLLMReal(
  systemPrompt: string,
  userPrompt: string,
  userId: string,
  feature: AIFeatureType,
  metadata?: Record<string, unknown>,
  conversationId?: string
): Promise<string | null> {
  if (!openai) return null;

  const start = Date.now();
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const duration = Date.now() - start;
    const response = completion.choices[0]?.message?.content || "";
    const tokensUsed = completion.usage?.total_tokens || 0;

    await AIInteraction.create({
      userId,
      feature,
      prompt: userPrompt,
      response,
      model: MODEL,
      tokensUsed,
      duration,
      metadata: { systemPrompt, ...metadata },
      conversationId,
    }).catch(() => {});

    return response;
  } catch (err: any) {
    const message = err?.message || err?.error?.message || "OpenAI API call failed";
    console.warn("[AI Service] OpenAI unavailable, using fallback:", message);
    return null;
  }
}

export async function generateTicketDraft(
  title: string,
  type: string,
  projectId: string,
  userId: string
) {
  const workspaceId = await resolveWorkspaceIdFromProject(projectId);
  if (workspaceId) await tryCheckAiCallLimit(workspaceId);

  const systemPrompt = "You are an expert project manager assistant that helps write clear, actionable tickets.";
  const prompt = `Generate a detailed ticket for a project management system.

Title: "${title}"
Type: "${type}"

Provide:
1. A detailed description (2-3 paragraphs)
2. Acceptance criteria (3-5 items as a JSON array of strings)
3. Suggested labels (2-4 items as a JSON array of strings)

Respond in JSON format with keys: description, acceptanceCriteria, suggestedLabels.`;

  const response = await callLLMReal(systemPrompt, prompt, userId, "ticket_writer");
  let result: {
    description: string;
    acceptanceCriteria: string[];
    suggestedLabels: string[];
  };
  const parsed = response ? parseJsonResponse<{
    description?: string;
    acceptanceCriteria?: string[];
    suggestedLabels?: string[];
  }>(response) : null;
  if (parsed) {
    result = {
      description: parsed.description || "",
      acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
      suggestedLabels: Array.isArray(parsed.suggestedLabels) ? parsed.suggestedLabels : [],
    };
  } else {
    result = fallbackTicketDraft(title, type);
    await recordFallbackInteraction(userId, "ticket_writer", prompt, JSON.stringify(result), { systemPrompt });
  }

  if (workspaceId) await tryRecordAiCall(workspaceId);
  return result;
}

export async function suggestCommentReply(
  taskKey: string,
  commentText: string,
  threadContext: string,
  userId: string
): Promise<string> {
  const workspaceId = await resolveWorkspaceIdFromTask(taskKey);
  if (workspaceId) await tryCheckAiCallLimit(workspaceId);

  const systemPrompt = "You are a professional project management assistant helping a user write a reply in a task comment thread. Be concise, professional, and helpful. Return ONLY the reply text itself — no preamble, no labels, no quotes, no 'Here is' introductions.";
  const prompt = `Task: ${taskKey}

Thread context:
${threadContext ? threadContext.substring(0, 1000) : "(empty)"}

The user is drafting this reply:
"${commentText || "(empty — suggest a general response)"}"

Write the reply (2-3 sentences). Plain response text only.`;

  const response = await callLLMReal(systemPrompt, prompt, userId, "comment_reply", { taskKey });
  if (response) return response;

  const fallback = fallbackCommentReply(commentText, threadContext);
  await recordFallbackInteraction(userId, "comment_reply", prompt, fallback, { systemPrompt, taskKey });
  if (workspaceId) await tryRecordAiCall(workspaceId);
  return fallback;
}

export async function summarizeThread(taskKey: string, userId: string) {
  const workspaceId = await resolveWorkspaceIdFromTask(taskKey);
  if (workspaceId) await tryCheckAiCallLimit(workspaceId);

  const comments = await Comment.find({ taskId: taskKey }).sort({ createdAt: 1 });

  const context = comments
    .map((c) => `- ${c.content.substring(0, 500)}`)
    .join("\n");

  const systemPrompt = "You are a project management assistant that summarizes task discussions. Be concise and actionable.";
  const prompt = `Summarize the following task discussion. Provide:
1. A brief summary (2-3 sentences)
2. Key points (as a JSON array of strings)
3. A suggested next action

Task comments:
${context || "No comments yet."}

Respond in JSON format with keys: summary, keyPoints, suggestedAction.`;

  const response = await callLLMReal(systemPrompt, prompt, userId, "summarizer");
  let result: {
    summary: string;
    keyPoints: string[];
    suggestedAction: string;
  };
  const parsed = response ? parseJsonResponse<{
    summary?: string;
    keyPoints?: string[];
    suggestedAction?: string;
  }>(response) : null;
  if (parsed) {
    result = {
      summary: parsed.summary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      suggestedAction: parsed.suggestedAction || "",
    };
  } else {
    result = fallbackSummarize(comments);
    await recordFallbackInteraction(userId, "summarizer", prompt, JSON.stringify(result), { systemPrompt });
  }

  if (workspaceId) await tryRecordAiCall(workspaceId);
  return result;
}

export async function smartTriage(
  taskTitle: string,
  taskDescription: string,
  workspaceId: string,
  userId: string
) {
  if (workspaceId) await tryCheckAiCallLimit(workspaceId);

  const systemPrompt = "You are a smart triage assistant for a project management platform. Analyze tasks and suggest assignee, priority, labels, and type.";
  const prompt = `Analyze this task and suggest triage decisions:

Title: "${taskTitle}"
Description: "${taskDescription}"

Respond in JSON format with:
- suggestedAssignee: null
- suggestedPriority: "lowest" | "low" | "medium" | "high" | "highest"
- suggestedLabels: array of label strings
- suggestedType: "task" | "bug" | "story" | "subtask"
- reasoning: brief explanation`;

  const response = await callLLMReal(systemPrompt, prompt, userId, "smart_triage");
  let result: {
    suggestedAssignee: string | null;
    suggestedPriority: string;
    suggestedLabels: string[];
    suggestedType: string;
    reasoning: string;
  };
  const parsed = response ? parseJsonResponse<{
    suggestedAssignee?: string | null;
    suggestedPriority?: string;
    suggestedLabels?: string[];
    suggestedType?: string;
    reasoning?: string;
  }>(response) : null;
  if (parsed) {
    result = {
      suggestedAssignee: parsed.suggestedAssignee || null,
      suggestedPriority: parsed.suggestedPriority || "medium",
      suggestedLabels: Array.isArray(parsed.suggestedLabels) ? parsed.suggestedLabels : [],
      suggestedType: parsed.suggestedType || "task",
      reasoning: parsed.reasoning || "",
    };
  } else {
    result = fallbackTriage(taskTitle);
    await recordFallbackInteraction(userId, "smart_triage", prompt, JSON.stringify(result), { systemPrompt });
  }

  if (workspaceId) await tryRecordAiCall(workspaceId);
  return result;
}

export async function suggestSprintPlan(
  projectId: string,
  sprintName: string,
  sprintCapacity: number,
  userId: string
) {
  const workspaceId = await resolveWorkspaceIdFromProject(projectId);
  if (workspaceId) await tryCheckAiCallLimit(workspaceId);

  const backlogTasks = await Task.find({ projectId, sprintId: null }).sort({ priority: -1, storyPoints: -1 });

  const taskList = backlogTasks
    .slice(0, 20)
    .map(
      (t) =>
        `- ${t.taskKey}: "${t.title}" (priority: ${t.priority}, points: ${t.storyPoints || "unestimated"}, type: ${t.type})`
    )
    .join("\n");

  const systemPrompt = "You are an agile sprint planning assistant. Suggest optimal sprint plans based on priority and capacity.";
  const prompt = `Suggest a sprint plan for "${sprintName}" with capacity ~${sprintCapacity} story points.

Backlog tasks:
${taskList || "No tasks in backlog."}

Respond in JSON format with:
- suggestedTasks: array of { taskKey: string, reason: string }
- goal: a sprint goal string
- estimatedPoints: total estimated points number`;

  const response = await callLLMReal(systemPrompt, prompt, userId, "sprint_planner");
  let result: {
    suggestedTasks: { taskKey: string; reason: string }[];
    goal: string;
    estimatedPoints: number;
  };
  const parsed = response ? parseJsonResponse<{
    suggestedTasks?: { taskKey?: string; reason?: string }[];
    goal?: string;
    estimatedPoints?: number;
  }>(response) : null;
  if (parsed) {
    result = {
      suggestedTasks: Array.isArray(parsed.suggestedTasks)
        ? parsed.suggestedTasks.map((t) => ({
            taskKey: String(t.taskKey || ""),
            reason: String(t.reason || ""),
          }))
        : [],
      goal: parsed.goal || "",
      estimatedPoints: typeof parsed.estimatedPoints === "number" ? parsed.estimatedPoints : 0,
    };
  } else {
    result = fallbackSprintPlan(sprintName, sprintCapacity, backlogTasks);
    await recordFallbackInteraction(userId, "sprint_planner", prompt, JSON.stringify(result), { systemPrompt });
  }

  if (workspaceId) await tryRecordAiCall(workspaceId);
  return result;
}

export async function chatWithAI(
  message: string,
  context: AiChatContext,
  userId: string,
  conversationId?: string
) {
  const workspaceId = await resolveAiWorkspaceId(context);
  if (workspaceId) await tryCheckAiCallLimit(workspaceId);

  let contextBlock = "";

  if (context.taskKey) {
    const task = await Task.findOne({ taskKey: context.taskKey });
    if (task) {
      contextBlock += `Current task: ${task.taskKey} - "${task.title}" (${task.status}, ${task.priority})\nDescription: ${task.description || "N/A"}\n`;
    }
  }

  if (context.workspaceId) {
    const workspace = await prisma.workspace.findUnique({ where: { id: context.workspaceId } });
    if (workspace) {
      contextBlock += `Workspace: ${workspace.name}\n`;
    }
  }

  const historyContext = conversationId
    ? await getConversationHistory(userId, conversationId, 10)
    : "";

  const systemPrompt = `You are VIREO AI, an intelligent project management assistant integrated into the VIREO platform. You help users with:
- Answering questions about their projects, tasks, and sprints
- Providing project management advice
- Explaining Agile/Scrum concepts
- Helping with task organization

Be concise, helpful, and professional. Current context:
${contextBlock || "No specific context."}
${historyContext ? `\nRecent conversation:\n${historyContext}` : ""}`;

  const response = await callLLMReal(systemPrompt, message, userId, "chat_assistant", undefined, conversationId);
  let result: { reply: string; conversationId: string };
  if (response) {
    result = { reply: response, conversationId: conversationId || newConversationId() };
  } else {
    const fallback = fallbackChat(message);
    result = { reply: fallback, conversationId: conversationId || newConversationId() };
    await recordFallbackInteraction(userId, "chat_assistant", message, fallback, { systemPrompt }, result.conversationId);
  }

  if (workspaceId) await tryRecordAiCall(workspaceId);
  return result;
}

function newConversationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getConversationHistory(
  userId: string,
  conversationId: string,
  limit = 10
): Promise<string> {
  const items = await AIInteraction.find({
    userId,
    feature: "chat_assistant",
    conversationId,
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("prompt response")
    .lean();

  return items.map((i) => `User: ${i.prompt}\nAssistant: ${i.response}`).join("\n\n");
}

export async function getAIConversations(userId: string, limit = 20) {
  const interactions = await AIInteraction.find({
    userId,
    feature: "chat_assistant",
    conversationId: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(limit * 3, 50))
    .select("conversationId prompt response createdAt")
    .lean();

  const grouped = new Map<string, { conversationId: string; prompt: string; response: string; createdAt: Date; updatedAt: Date; count: number }>();
  for (const item of interactions) {
    if (!item.conversationId) continue;
    const existing = grouped.get(item.conversationId);
    if (existing) {
      existing.count += 1;
      if (new Date(item.createdAt) > new Date(existing.updatedAt)) {
        existing.updatedAt = item.createdAt;
      }
    } else {
      grouped.set(item.conversationId, {
        conversationId: item.conversationId,
        prompt: item.prompt,
        response: item.response,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        count: 1,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export async function getAIConversation(userId: string, conversationId: string) {
  return AIInteraction.find({
    userId,
    feature: "chat_assistant",
    conversationId,
  })
    .sort({ createdAt: 1 })
    .select("prompt response createdAt")
    .lean();
}

export async function getAIHistory(
  userId: string,
  feature?: AIFeatureType,
  limit = 20
) {
  const filter: Record<string, unknown> = { userId };
  if (feature) filter.feature = feature;

  return AIInteraction.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("feature prompt response model tokensUsed duration createdAt");
}