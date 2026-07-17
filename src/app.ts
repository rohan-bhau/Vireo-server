import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config";
import { connectMongoDB } from "./config/mongoose";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import workspaceRoutes from "./routes/workspace";
import invitationRoutes from "./routes/invitation";
import projectRoutes from "./routes/project";
import projectsRoutes from "./routes/projects";
import boardRoutes from "./routes/board";
import taskRoutes from "./routes/task";
import notificationRoutes from "./routes/notification";
import sprintRoutes from "./routes/sprint";
import epicRoutes from "./routes/epic";
import workflowRoutes from "./routes/workflow";
import automationRoutes from "./routes/automation";
import searchRoutes from "./routes/search";
import savedFilterRoutes from "./routes/savedFilter";
import aiRoutes from "./routes/ai";
import auditLogRoutes from "./routes/auditLog";
import integrationRoutes from "./routes/integration";
import dashboardRoutes from "./routes/dashboard";
import { createSocketServer } from "./socket";

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());

connectMongoDB();

createSocketServer(httpServer);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/workspaces/:workspaceId/projects", projectRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/epics", epicRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/automation", automationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/filters", savedFilterRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
