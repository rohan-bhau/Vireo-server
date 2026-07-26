import Task from "../models/mongoose/Task";

export async function getProjectLabels(projectId: string) {
  const tasks = await Task.find({ projectId }, { labels: 1 });
  const labelCounts = new Map<string, number>();
  for (const task of tasks) {
    for (const label of task.labels) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
  }
  return Array.from(labelCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function suggestLabels(projectId: string, query: string) {
  const tasks = await Task.find({ projectId }, { labels: 1 });
  const labelSet = new Set<string>();
  for (const task of tasks) {
    for (const label of task.labels) {
      if (label.toLowerCase().includes(query.toLowerCase())) {
        labelSet.add(label);
      }
    }
  }
  return Array.from(labelSet).sort();
}

export async function getWorkspaceLabels(workspaceId: string) {
  const tasks = await Task.find({ workspaceId }, { labels: 1 });
  const labelSet = new Set<string>();
  for (const task of tasks) {
    for (const label of task.labels) {
      labelSet.add(label);
    }
  }
  return Array.from(labelSet).sort();
}

export async function mergeLabels(projectId: string, sourceLabel: string, targetLabel: string) {
  const result = await Task.updateMany(
    { projectId, labels: sourceLabel },
    { $pull: { labels: sourceLabel }, $addToSet: { labels: targetLabel } }
  );
  return { modifiedCount: result.modifiedCount };
}
