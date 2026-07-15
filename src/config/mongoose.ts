import mongoose from "mongoose";
import { config } from "./index";

export async function connectMongoDB(): Promise<void> {
  try {
    const conn = await mongoose.connect(config.mongodbUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}
