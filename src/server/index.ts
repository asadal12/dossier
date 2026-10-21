// Load .env automatically if present (Node.js 20+)
if (typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile();
  } catch {
    // .env file is optional if env vars are provided by host/system
  }
}

// Handle CSS module imports in server-side SSR Node rendering
if (typeof require !== "undefined" && (require as any).extensions) {
  (require as any).extensions[".css"] = (module: any) => {
    const proxy = new Proxy({}, {
      get: (_target, prop) => String(prop),
    });
    module.exports = proxy;
    module.exports.default = proxy;
  };
}

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";

import { checkEnvOnStartup } from "@/lib/env";
import { recoverInterruptedJobs } from "@/lib/jobs/runner";
import { startJobSweep } from "@/lib/jobs/retention";
import { startBackupSchedule } from "@/lib/backup-schedule";
import { startInboxSchedule } from "@/lib/google/sync";
import { startAgentSchedule } from "@/lib/agent/schedule";
import { recordEnvChoice, usagePingNotice } from "@/lib/usage-ping";
import { loadSettings } from "@/lib/settings-data";
import { logServerError } from "@/lib/log";

async function runStartupTasks(): Promise<void> {
  checkEnvOnStartup();

  await recoverInterruptedJobs().catch((error: unknown) => logServerError("startup", error));
  startJobSweep();
  startBackupSchedule();
  startInboxSchedule();
  startAgentSchedule();

  try {
    await recordEnvChoice();
    const notice = usagePingNotice(await loadSettings());
    if (notice) console.log(notice);
  } catch (error) {
    logServerError("usage ping", error);
  }
}

export async function startServer(): Promise<{ server: http.Server; port: number; app: express.Express }> {
  await runStartupTasks();

  const { createApp } = await import("./app");
  const app = createApp();
  const server = http.createServer(app);
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      const rawBase = process.env.BASE_PATH?.trim().replace(/\/+$/, "");
      const basePath = rawBase && rawBase !== "/" ? (rawBase.startsWith("/") ? rawBase : `/${rawBase}`) : "";
      if (basePath) {
        app.use(basePath, express.static(distPath));
        app.get(`${basePath}*`, (req, res, next) => {
          if (req.path.startsWith(`${basePath}/api/`) || req.path.startsWith(`${basePath}/print/`)) return next();
          res.sendFile(path.join(distPath, "index.html"));
        });
      }
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/") || req.path.startsWith("/print/")) return next();
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Dossier is running on http://localhost:${port}`);
      resolve();
    });
  });

  return { server, port, app };
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
