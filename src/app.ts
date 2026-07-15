import express from "express";
import cors from "cors";
import { config } from "./config";
import { connectMongoDB } from "./config/mongoose";
import { initializeSocket } from "./socket";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  connectMongoDB();
});

initializeSocket(server);

export default app;
