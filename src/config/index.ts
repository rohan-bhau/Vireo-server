import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/vireo",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/vireo",

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "noreply@vireo.app",
  },

  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    apiUrl: process.env.LLM_API_URL || "https://api.openai.com/v1",
  },

  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};
