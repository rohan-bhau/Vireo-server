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

app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
