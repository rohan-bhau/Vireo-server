import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/vireo",
  databaseUrl: process.env.DATABASE_URL || "",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15d",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
  emailFrom: process.env.EMAIL_FROM || "noreply@vireo.app",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  llm: {
    apiKey: process.env.LLM_API_KEY || "",
    apiUrl: process.env.LLM_API_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || "",
    enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
  },
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    githubClientId: process.env.GITHUB_CLIENT_ID || "",
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  },
};
