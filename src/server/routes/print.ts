import { Router } from "express";
import React from "react";
import { renderToString } from "react-dom/server";

import { loadDocuments } from "@/lib/application-documents";
import { getSession } from "@/lib/auth/session";
import { PRINT_TOKEN_HEADER, verifyPrintToken } from "@/lib/pdf/print-token";
import { loadProfile } from "@/lib/profile-data";
import { loadSettings } from "@/lib/settings-data";
import { loadTheme } from "@/lib/theme-data";
import { BUILT_IN_THEMES, printCss } from "@/lib/themes";

export const printRouter = Router();

async function checkPrintAccess(req: any, path: string): Promise<boolean> {
  const token = req.headers[PRINT_TOKEN_HEADER] as string | undefined;
  if (await verifyPrintToken(token, path)) return true;
  const session = await getSession();
  return Boolean(session);
}

function wrapPrintHtml(css: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/src/app/globals.css">
  <style>${css}</style>
</head>
<body style="margin: 0; background: white;">
  ${content}
</body>
</html>`;
}

printRouter.get("/print/base", async (req, res) => {
  const allowed = await checkPrintAccess(req, "/print/base");
  if (!allowed) {
    res.redirect("/login?next=/print/base");
    return;
  }
  const [profile, settings] = await Promise.all([loadProfile(), loadSettings()]);
  const theme = (await loadTheme(settings.baseThemeId)) ?? BUILT_IN_THEMES[0];
  const { ResumeDocument } = await import("@/components/documents/resume-document");

  const htmlContent = renderToString(
    React.createElement(ResumeDocument, {
      theme,
      profile,
      paper: settings.paper,
      includeReferences: settings.includeRefs,
      language: settings.resumeLanguage,
    }),
  );

  const fullHtml = wrapPrintHtml(printCss(theme, settings.paper), htmlContent);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(fullHtml);
});

printRouter.get("/print/resume/:id", async (req, res) => {
  const { id } = req.params;
  const path = `/print/resume/${id}`;
  const allowed = await checkPrintAccess(req, path);
  if (!allowed) {
    res.redirect(`/login?next=${encodeURIComponent(path)}`);
    return;
  }

  const [documents, settings] = await Promise.all([loadDocuments(id), loadSettings()]);
  if (!documents || !documents.resume) {
    res.status(404).send("Document not found");
    return;
  }

  const { theme } = documents.resume;
  const paper = settings.paper;
  const { TailoredResume } = await import("@/components/documents/tailored-documents");

  const htmlContent = renderToString(
    React.createElement(TailoredResume, {
      resume: documents.resume,
      profile: documents.profile,
      paper,
      followThemeLayout: true,
      language: documents.application.language,
      includeReferences: documents.includeReferences,
    }),
  );

  const fullHtml = wrapPrintHtml(printCss(theme, paper), htmlContent);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(fullHtml);
});

printRouter.get("/print/letter/:id", async (req, res) => {
  const { id } = req.params;
  const path = `/print/letter/${id}`;
  const allowed = await checkPrintAccess(req, path);
  if (!allowed) {
    res.redirect(`/login?next=${encodeURIComponent(path)}`);
    return;
  }

  const [documents, settings] = await Promise.all([loadDocuments(id), loadSettings()]);
  if (!documents || !documents.letter) {
    res.status(404).send("Document not found");
    return;
  }

  const { theme } = documents.letter;
  const paper = settings.paper;
  const { TailoredLetter } = await import("@/components/documents/tailored-documents");

  const htmlContent = renderToString(
    React.createElement(TailoredLetter, {
      letter: documents.letter,
      profile: documents.profile,
      paper,
      company: documents.application.company,
      location: documents.application.location,
      tone: documents.application.tone,
      date: documents.letterDate,
      dateFormat: settings.dateFormat,
      language: documents.application.language,
    }),
  );

  const fullHtml = wrapPrintHtml(printCss(theme, paper), htmlContent);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(fullHtml);
});
