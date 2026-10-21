import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { appVersion } from "@/lib/version";

const DB_TIMEOUT_MS = 3_000;

export const healthRouter = Router();

healthRouter.get("/api/health", async (_req, res) => {
  const db = await Promise.race([
    prisma.$queryRaw`SELECT 1`.then(() => "ok" as const),
    new Promise<"unreachable">((resolve) => setTimeout(() => resolve("unreachable"), DB_TIMEOUT_MS).unref()),
  ]).catch(() => "unreachable" as const);

  res.setHeader("Cache-Control", "no-store");
  res.status(db === "ok" ? 200 : 503).json({
    status: db === "ok" ? "ok" : "unavailable",
    version: appVersion,
    db,
  });
});
