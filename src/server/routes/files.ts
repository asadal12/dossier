import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";

import { DocumentKind, JobStatus } from "@/generated/prisma/enums";
import { writeBackup } from "@/lib/backups";
import { buildExport, exportFileName } from "@/lib/data-export";
import { currentSummary, importExport, parseExport, summarizeExport } from "@/lib/data-import";
import { contentDisposition, resolveFileName } from "@/lib/file-name";
import { IMPORT_MAX_BYTES, IMPORT_TOO_BIG } from "@/lib/import-limits";
import { isAiConfigured } from "@/lib/ai/config";
import { discardProfileImports, importProfileJob } from "@/lib/jobs/import-profile";
import { cancelJob, getJob, startJob } from "@/lib/jobs/runner";
import { downloadsDir, zipPdfsJob } from "@/lib/jobs/zip-pdfs";
import { holdPdf, heldPdf } from "@/lib/pdf/downloads";
import { renderPdf } from "@/lib/pdf/render";
import { prisma } from "@/lib/prisma";
import { loadProfileName } from "@/lib/profile-data";
import { RESUME_MAX_BYTES, RESUME_MESSAGES, resumeText } from "@/lib/resume-text";
import { loadSettings } from "@/lib/settings-data";

export const filesRouter = Router();

const GONE_DOWNLOAD = "That download isn't here any more. Start a new one from Settings → Your data.";
const GONE_PDF = "That PDF isn't here any more. Download it again.";
const TAILORED = { resume: DocumentKind.RESUME, letter: DocumentKind.COVER_LETTER } as const;
const APPLICATION_ID = /^[a-z0-9]{1,64}$/i;

// GET /api/export
filesRouter.get("/api/export", async (req, res) => {
  const now = new Date();
  const includeApiKey = req.query.apiKey === "1";
  const data = await buildExport(prisma, { includeApiKey, now });
  const filename = exportFileName(now);

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", contentDisposition(filename));
  res.send(JSON.stringify(data, null, 2));
});

// POST /api/import
filesRouter.post("/api/import", async (req, res) => {
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > IMPORT_MAX_BYTES) {
    res.status(413).json({ error: IMPORT_TOO_BIG });
    return;
  }

  let body = "";
  if (typeof req.body === "string") {
    body = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    body = req.body.toString("utf8");
  } else if (typeof req.body === "object") {
    body = JSON.stringify(req.body);
  }

  const parsed = parseExport(body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const incoming = summarizeExport(parsed.data);

  if (req.query.preview === "1") {
    res.json({ incoming, current: await currentSummary(prisma), exportedAt: parsed.data.exportedAt });
    return;
  }

  const unfinished = await prisma.job.findMany({
    where: { status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } },
    select: { id: true },
  });
  for (const job of unfinished) await cancelJob(job.id);

  const backup = await writeBackup("before-import");
  await importExport(prisma, parsed.data);
  res.json({ incoming, backup });
});

// POST /api/profile/import
filesRouter.post("/api/profile/import", async (req, res) => {
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > RESUME_MAX_BYTES) {
    res.status(413).json({ error: RESUME_MESSAGES.tooBig });
    return;
  }
  if (!(await isAiConfigured())) {
    res.status(409).json({ error: "Choose an AI provider in Settings first: it's what reads the resume." });
    return;
  }

  let fileBuffer: Buffer;
  if (Buffer.isBuffer(req.body)) {
    fileBuffer = req.body;
  } else if (typeof req.body === "string") {
    fileBuffer = Buffer.from(req.body);
  } else {
    // If parsed by express.raw or multer
    fileBuffer = Buffer.from("");
  }

  const read = await resumeText(new Uint8Array(fileBuffer));
  if (!read.ok) {
    res.status(400).json({ error: read.error });
    return;
  }
  await discardProfileImports();
  const jobId = await startJob(importProfileJob, { resume: read.text }, { key: "profile-import" });
  res.json({ jobId });
});

// GET /api/downloads/:id
filesRouter.get("/api/downloads/:id", async (req, res) => {
  const { id } = req.params;
  const job = await getJob(id);
  const result = job?.type === zipPdfsJob.type && job.status === "DONE" ? zipPdfsJob.result.safeParse(job.result) : null;
  if (!result?.success) {
    res.status(404).json({ error: GONE_DOWNLOAD });
    return;
  }

  const file = path.join(downloadsDir(), result.data.file);
  const zip = await readFile(file).catch(() => null);
  if (!zip) {
    res.status(410).json({ error: GONE_DOWNLOAD });
    return;
  }
  await unlink(file).catch(() => {});

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", contentDisposition(result.data.fileName));
  res.send(zip);
});

async function renderRequestedPdf(req: any): Promise<{ pdf: Uint8Array; fileName: string } | { error: string; status: number }> {
  const doc = req.query.doc as string | undefined;
  const [name, settings] = await Promise.all([loadProfileName(), loadSettings()]);
  const date = new Date();

  if (doc === "base") {
    return {
      pdf: await renderPdf("/print/base"),
      fileName: resolveFileName(settings.fileNamePattern, { name, doc: DocumentKind.RESUME, date }),
    };
  }

  if (doc !== "resume" && doc !== "letter") {
    return { error: "There's no such document to download.", status: 404 };
  }
  const id = (req.query.application as string) ?? "";
  const application = APPLICATION_ID.test(id)
    ? await prisma.application.findUnique({
        where: { id },
        select: { company: true, role: true, documents: { where: { kind: TAILORED[doc] }, select: { id: true } } },
      })
    : null;
  if (!application) return { error: "That application no longer exists.", status: 404 };
  if (application.documents.length === 0) {
    return { error: doc === "resume" ? "This application has no tailored resume." : "This application has no cover letter.", status: 404 };
  }

  return {
    pdf: await renderPdf(`/print/${doc}/${id}`),
    fileName: resolveFileName(settings.fileNamePattern, { name, company: application.company, role: application.role, doc: TAILORED[doc], date }),
  };
}

// GET /api/pdf
filesRouter.get("/api/pdf", async (req, res) => {
  const rendered = await renderRequestedPdf(req);
  if ("error" in rendered) {
    res.status(rendered.status).json({ error: rendered.error });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", contentDisposition(rendered.fileName));
  res.send(Buffer.from(rendered.pdf));
});

// POST /api/pdf
filesRouter.post("/api/pdf", async (req, res) => {
  const rendered = await renderRequestedPdf(req);
  if ("error" in rendered) {
    res.status(rendered.status).json({ error: rendered.error });
    return;
  }
  res.json({ url: `/api/pdf/${holdPdf(rendered.pdf, rendered.fileName)}` });
});

// GET /api/pdf/:id
filesRouter.get("/api/pdf/:id", async (req, res) => {
  const held = heldPdf(req.params.id);
  if (!held) {
    res.status(404).json({ error: GONE_PDF });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", contentDisposition(held.fileName));
  res.send(Buffer.from(held.pdf));
});
