import express from "express";
import cors from "cors";
import { config } from "./config";
import { connectMongoDB } from "./config/mongoose";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";

const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());

connectMongoDB();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use(errorHandler);

export default app;
