import OpenAI from "openai";
import { config } from "../config";
import AIInteraction, { AIFeatureType } from "../models/mongoose/AIInteraction";
import Task from "../models/mongoose/Task";
import Comment from "../models/mongoose/Comment";
import { prisma } from "../config/prisma";
import { checkAiCallLimit, recordAiCall } from "./billing";
import {
  fallbackTicketDraft,
  fallbackSummarize,
  fallbackTriage,
  fallbackSprintPlan,
  fallbackChat,
} from "./fallbackAI";

let openai: OpenAI | null = null;
let openaiAvailable = true;

try {
  if (config.llm.apiKey) {
    openai = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.apiUrl,
    });
  } else {
    openaiAvailable = false;
    console.warn("[AI Service] No LLM_API_KEY configured. Using fallback AI responses.");
  }
} catch (err) {
  openaiAvailable = false;
  console.warn("[AI Service] Failed to initialize OpenAI. Using fallback AI responses.");
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

async function callLLMReal(
  systemPrompt: string,
  userPrompt: string,
  userId: string,
  feature: AIFeatureType,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  if (!openai || !openaiAvailable) return null;

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
    }).catch(() => {});

    return response;
  } catch (err: any) {
    const message = err?.message || err?.error?.message || "OpenAI API call failed";
    console.warn("[AI Service] OpenAI unavailable, using fallback:", message);
    openaiAvailable = false;
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
  if (workspaceId) await checkAiCallLimit(workspaceId);

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
  if (response) {
    try {
      const parsed = JSON.parse(response);
      result = {
        description: parsed.description || "",
        acceptanceCriteria: parsed.acceptanceCriteria || [],
        suggestedLabels: parsed.suggestedLabels || [],
      };
    } catch {
      result = fallbackTicketDraft(title, type);
    }
  } else {
    result = fallbackTicketDraft(title, type);
  }

  if (workspaceId) await recordAiCall(workspaceId);
  return result;
}

export async function summarizeThread(taskKey: string, userId: string) {
  const workspaceId = await resolveWorkspaceIdFromTask(taskKey);
  if (workspaceId) await checkAiCallLimit(workspaceId);

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
  if (response) {
    try {
      const parsed = JSON.parse(response);
      result = {
        summary: parsed.summary || "",
        keyPoints: parsed.keyPoints || [],
        suggestedAction: parsed.suggestedAction || "",
      };
    } catch {
      result = fallbackSummarize(comments);
    }
  } else {
    result = fallbackSummarize(comments);
  }

  if (workspaceId) await recordAiCall(workspaceId);
  return result;
}

export async function smartTriage(
  taskTitle: string,
  taskDescription: string,
  workspaceId: string,
  userId: string
) {
  if (workspaceId) await checkAiCallLimit(workspaceId);

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
  if (response) {
    try {
      const parsed = JSON.parse(response);
      result = {
        suggestedAssignee: parsed.suggestedAssignee || null,
        suggestedPriority: parsed.suggestedPriority || "medium",
        suggestedLabels: parsed.suggestedLabels || [],
        suggestedType: parsed.suggestedType || "task",
        reasoning: parsed.reasoning || "",
      };
    } catch {
      result = fallbackTriage(taskTitle);
    }
  } else {
    result = fallbackTriage(taskTitle);
  }

  if (workspaceId) await recordAiCall(workspaceId);
  return result;
}

export async function suggestSprintPlan(
  projectId: string,
  sprintName: string,
  sprintCapacity: number,
  userId: string
) {
  const workspaceId = await resolveWorkspaceIdFromProject(projectId);
  if (workspaceId) await checkAiCallLimit(workspaceId);

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
  if (response) {
    try {
      const parsed = JSON.parse(response);
      result = {
        suggestedTasks: parsed.suggestedTasks || [],
        goal: parsed.goal || "",
        estimatedPoints: parsed.estimatedPoints || 0,
      };
    } catch {
      result = fallbackSprintPlan(sprintName, sprintCapacity, backlogTasks.length);
    }
  } else {
    result = fallbackSprintPlan(sprintName, sprintCapacity, backlogTasks.length);
  }

  if (workspaceId) await recordAiCall(workspaceId);
  return result;
}

export async function chatWithAI(
  message: string,
  context: AiChatContext,
  userId: string
) {
  const workspaceId = await resolveAiWorkspaceId(context);
  if (workspaceId) await checkAiCallLimit(workspaceId);

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

  const systemPrompt = `You are VIREO AI, an intelligent project management assistant integrated into the VIREO platform. You help users with:
- Answering questions about their projects, tasks, and sprints
- Providing project management advice
- Explaining Agile/Scrum concepts
- Helping with task organization

Be concise, helpful, and professional. Current context:
${contextBlock || "No specific context."}`;

  const response = await callLLMReal(systemPrompt, message, userId, "chat_assistant");
  let result: { reply: string };
  if (response) {
    result = { reply: response };
  } else {
    result = { reply: fallbackChat(message) };
  }

  if (workspaceId) await recordAiCall(workspaceId);
  return result;
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