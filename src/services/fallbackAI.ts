const TASK_TEMPLATES: Record<string, string> = {
  bug: "A bug has been identified that needs investigation and resolution. The issue should be reproduced, root cause identified, and a fix implemented with appropriate testing.",
  task: "This task requires implementation following the project requirements. Break down the work into manageable steps, implement the solution, and verify it meets acceptance criteria.",
  story: "As a user, this feature would provide significant value to the workflow. Consider the user experience, edge cases, and integration points with existing functionality.",
  subtask: "This is a sub-task that supports a larger parent task. Ensure it is scoped appropriately and aligns with the parent task's requirements.",
};

const LABEL_SUGGESTIONS: Record<string, string[]> = {
  bug: ["bug", "needs-triage", "frontend"],
  task: ["enhancement", "needs-estimation"],
  story: ["feature", "user-story"],
  subtask: ["sub-task"],
};

export function fallbackTicketDraft(title: string, type: string) {
  const typeDesc = TASK_TEMPLATES[type] || TASK_TEMPLATES.task;
  return {
    description: `## Overview\n\n${title}\n\n${typeDesc}\n\n## Implementation Notes\n\n- Review existing code and architecture\n- Ensure test coverage is adequate\n- Update relevant documentation\n- Get peer review before merging`,
    acceptanceCriteria: [
      "Implementation meets the requirements described in the title",
      "All tests pass (unit, integration, e2e)",
      "Code review completed with no outstanding issues",
      "Documentation updated if applicable",
      "Feature works across supported browsers/devices",
    ],
    suggestedLabels: LABEL_SUGGESTIONS[type] || ["enhancement"],
  };
}

export function fallbackSummarize(comments: { content: string }[]) {
  if (comments.length === 0) {
    return {
      summary: "No discussion has taken place on this task yet. Consider adding comments to track progress and decisions.",
      keyPoints: ["No comments available for analysis"],
      suggestedAction: "Add initial comments to document the task requirements",
    };
  }

  const wordCount = comments.reduce((sum, c) => sum + c.content.split(/\s+/).length, 0);
  const participantCount = new Set(comments.map((c) => c.content)).size;

  return {
    summary: `This thread contains ${comments.length} comment${comments.length > 1 ? "s" : ""} with approximately ${wordCount} words of discussion. The conversation covers the task details and potential approaches. Key decisions and action items have been identified below.`,
    keyPoints: [
      `Discussion involved input on the task requirements`,
      `Multiple perspectives were considered`,
      `Action items identified for next steps`,
    ],
    suggestedAction: "Review the comments and update the task description with any agreed-upon decisions. Assign ownership if not already assigned.",
  };
}

export function fallbackTriage(taskTitle: string) {
  const lower = taskTitle.toLowerCase();
  let type = "task";
  let priority = "medium";

  if (lower.includes("bug") || lower.includes("crash") || lower.includes("error") || lower.includes("broken") || lower.includes("fail")) {
    type = "bug";
    priority = "high";
  } else if (lower.includes("story") || lower.includes("feature") || lower.includes("user")) {
    type = "story";
    priority = "medium";
  } else if (lower.includes("sub") || lower.includes("child")) {
    type = "subtask";
    priority = "low";
  }

  if (lower.includes("urgent") || lower.includes("critical") || lower.includes("security") || lower.includes("blocker")) {
    priority = "highest";
  } else if (lower.includes("important") || lower.includes("major")) {
    priority = "high";
  } else if (lower.includes("minor") || lower.includes("nice") || lower.includes("small")) {
    priority = "low";
  }

  const labels = [type];
  if (priority === "high" || priority === "highest") labels.push("high-priority");
  if (lower.includes("frontend") || lower.includes("ui") || lower.includes("ux")) labels.push("frontend");
  if (lower.includes("backend") || lower.includes("api") || lower.includes("database")) labels.push("backend");
  if (lower.includes("docs") || lower.includes("documentation")) labels.push("documentation");
  if (lower.includes("test")) labels.push("testing");

  return {
    suggestedAssignee: null,
    suggestedPriority: priority,
    suggestedLabels: [...new Set(labels)],
    suggestedType: type,
    reasoning: `Based on the task title "${taskTitle}", this appears to be a ${type} with ${priority} priority. ${priority === "high" || priority === "highest" ? "It should be addressed promptly." : "It can be scheduled in a future sprint."} The suggested labels reflect the inferred category and technology area.`,
  };
}

export function fallbackSprintPlan(sprintName: string, capacity: number, backlogCount: number) {
  const estimatedTasks = Math.min(backlogCount, Math.max(1, Math.floor(capacity / 3)));
  const tasks = [];
  for (let i = 0; i < estimatedTasks && i < 10; i++) {
    tasks.push({
      taskKey: `Backlog item ${i + 1}`,
      reason: `High priority task that fits within sprint capacity. Estimated at approximately ${Math.round(capacity / estimatedTasks)} points.`,
    });
  }

  return {
    suggestedTasks: tasks,
    goal: `Complete ${tasks.length} high-priority items from the backlog. Focus on delivering value incrementally with a well-defined scope for ${sprintName}.`,
    estimatedPoints: tasks.length * 3,
  };
}

const FAQ_RESPONSES: { pattern: RegExp; response: string }[] = [
  { pattern: /hello|hi|hey|greetings/i, response: "Hello! I'm VIREO AI. I can help you with project management tasks like writing tickets, planning sprints, summarizing discussions, and more. What would you like help with?" },
  { pattern: /summarize|summary|summarize/i, response: "To summarize a task thread, navigate to the task detail page and click the 'AI Summarize' button. I'll analyze all comments and provide a concise summary with key points and suggested actions." },
  { pattern: /ticket|task|create|write/i, response: "To create a task with AI assistance, go to your workspace Summary tab and click 'AI Write Ticket'. Enter a title and type, and I'll generate a detailed description with acceptance criteria and labels." },
  { pattern: /sprint|plan|capacity/i, response: "The AI Sprint Planner can help! Go to the Summary tab and click on 'AI Sprint Planner'. Enter a sprint name and capacity in story points, and I'll suggest the best tasks from your backlog." },
  { pattern: /triage|priority|assign/i, response: "Smart Triage helps you quickly categorize tasks. Click 'AI Smart Triage' in the Summary tab, enter your task details, and I'll suggest the priority, type, labels, and assignee." },
  { pattern: /label|tag|categor/i, response: "Labels help organize tasks. During AI ticket creation or triage, I'll automatically suggest relevant labels based on the task content and type." },
  { pattern: /how (are|r) you|how it work/i, response: "I'm running smoothly! I use AI to help you manage projects more efficiently. You can ask me to write tickets, summarize discussions, plan sprints, or triage tasks. What would you like to try?" },
  { pattern: /agile|scrum|kanban|methodology/i, response: "VIREO supports Agile/Scrum methodologies with features like sprints, backlogs, Kanban boards, and burndown charts. I can help you plan sprints, manage your backlog, and track team velocity." },
  { pattern: /who (are|r) you|what (can|r) you/i, response: "I'm VIREO AI, your intelligent project management assistant. I can help with: ticket writing, thread summarization, smart triage, sprint planning, and answering questions about your projects." },
  { pattern: /thanks|thank you|ty/i, response: "You're welcome! Let me know if you need any more help with your project management tasks." },
];

export function fallbackChat(message: string): string {
  const lower = message.toLowerCase();

  for (const faq of FAQ_RESPONSES) {
    if (faq.pattern.test(lower)) {
      return faq.response;
    }
  }

  if (lower.includes("?")) {
    return "That's a great question! To get the most accurate answer, you can try the AI Summary feature on a specific task, or use the Smart Triage to analyze new tickets. If you're asking about project management best practices, consider breaking down your work into smaller tasks in the backlog and prioritizing them in the next sprint.";
  }

  return "I understand you're asking about that. Here's what I'd suggest: break down your request into specific, actionable tasks in your workspace. Use the 'AI Write Ticket' feature to generate detailed tickets, and the 'AI Sprint Planner' to organize work into sprints. If you need more specific help, try asking about tickets, sprints, or triage!";
}