import cookieParser from "cookie-parser";
import express from "express";

import { requestContext } from "@/server/context";
import { requireAuth } from "@/server/middleware/auth";
import { privateNoStore, sameOriginProtection, securityHeaders } from "@/server/middleware/security";
import { actionsRouter } from "@/server/routes/actions";
import { authRouter } from "@/server/routes/auth";
import { filesRouter } from "@/server/routes/files";
import { googleRouter } from "@/server/routes/google";
import { healthRouter } from "@/server/routes/health";
import { jobsRouter } from "@/server/routes/jobs";
import { loadersRouter } from "@/server/routes/loaders";
import { printRouter } from "@/server/routes/print";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  // Security headers on all requests
  app.use(securityHeaders);

  // Parse cookies
  app.use(cookieParser());

  // Raw body for file uploads (import, resume upload)
  app.use(
    express.raw({
      type: [
        "application/octet-stream",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
      limit: "10mb",
    }),
  );

  // JSON and URL-encoded bodies
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Set per-request AsyncLocalStorage context
  app.use((req, res, next) => {
    requestContext.run({ req, res }, next);
  });

  // Next.js redirect compatibility
  const apiRouter = express.Router();

  apiRouter.get("/calendar", (req, res) => {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(302, `/${query}`);
  });

  // Unauthenticated / special routes
  apiRouter.use(healthRouter);
  apiRouter.use(printRouter);
  apiRouter.use(authRouter);

  // Google callback is handled without session/same-origin requirement (OAuth redirect from Google)
  apiRouter.use(googleRouter);

  // Protected API routes
  apiRouter.use("/api", sameOriginProtection, requireAuth, privateNoStore);
  apiRouter.use(loadersRouter);
  apiRouter.use(actionsRouter);
  apiRouter.use(filesRouter);
  apiRouter.use(jobsRouter);

  // Mount at root and optionally under BASE_PATH (e.g. /job)
  app.use(apiRouter);
  const rawBase = process.env.BASE_PATH?.trim().replace(/\/+$/, "");
  const basePath = rawBase && rawBase !== "/" ? (rawBase.startsWith("/") ? rawBase : `/${rawBase}`) : "";
  if (basePath) {
    app.use(basePath, apiRouter);
  }

  return app;
}
