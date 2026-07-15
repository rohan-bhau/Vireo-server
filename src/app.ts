import express from "express";
import cors from "cors";
import { config } from "./config";
import { connectMongoDB } from "./config/mongoose";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import workspaceRoutes from "./routes/workspace";
import invitationRoutes from "./routes/invitation";

const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());

connectMongoDB();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/invitations", invitationRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
