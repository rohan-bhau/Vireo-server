import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./index";

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  max: 10,
  min: 1,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 1_000,
});

export const prisma = new PrismaClient({ adapter });
