import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  if (process.env.LOCAL_PG) {
    // Local review only: plain pg adapter against a local Postgres.
    // Resolved at runtime so bundlers never see the specifier.
    const nodeRequire = process
      .getBuiltinModule("node:module")
      .createRequire(process.cwd() + "/index.js");
    const { PrismaPg } = nodeRequire("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    return new PrismaClient({ adapter });
  }
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
