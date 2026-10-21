import { Router } from "express";
import { getJob, isFinished, subscribeJob, type JobView } from "@/lib/jobs/runner";

export const jobsRouter = Router();

const HEARTBEAT_MS = 15_000;

// GET /api/jobs/:id
jobsRouter.get("/api/jobs/:id", async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "That job doesn't exist." });
    return;
  }
  res.json(job);
});

// GET /api/jobs/:id/events (Server-Sent Events)
jobsRouter.get("/api/jobs/:id/events", async (req, res) => {
  const { id } = req.params;
  const initialJob = await getJob(id);
  if (!initialJob) {
    res.status(404).json({ error: "That job doesn't exist." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });

  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) res.write(": still working\n\n");
  }, HEARTBEAT_MS);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  };

  const send = (job: JobView) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(job)}\n\n`);
    if (isFinished(job)) cleanup();
  };

  const unsubscribe = subscribeJob(id, send);
  req.on("close", cleanup);

  send(initialJob);
});
