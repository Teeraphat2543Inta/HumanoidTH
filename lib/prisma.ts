import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for Prisma.");
}

// One pool per process, reused across requests. The pooled Neon endpoint
// (-pooler) already fronts Postgres with PgBouncer, so a small pool per
// instance is enough and keeps us well under the connection limit when
// several serverless instances are warm at once.
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000
  });

// On Vercel Fluid compute this lets the runtime drain the pool before an
// instance is frozen or shut down, instead of leaving connections stranded.
if (process.env.VERCEL && !globalForPrisma.pool) {
  void import("@vercel/functions")
    .then(({ attachDatabasePool }) => attachDatabasePool(pool))
    .catch(() => {
      // Outside the Vercel runtime this helper is unavailable; the pool still
      // works, it just will not be drained early.
    });
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.PRISMA_LOG_LEVEL === "silent" ? [] : process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
