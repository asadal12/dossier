import { Router } from "express";

import { activityTimeline } from "@/lib/activity";
import { loadAgentView } from "@/lib/agent/view";
import { isAiConfigured, loadAiSettingsView } from "@/lib/ai/config";
import { editsSchema, matchSchema, matchScore } from "@/lib/application-data";
import { loadDocuments, readJson } from "@/lib/application-documents";
import { listSummary, resolveListParams, statusesIn } from "@/lib/applications-list";
import { loadApplicationRows } from "@/lib/applications-data";
import { backupsDir } from "@/lib/backups";
import { lastNightlyBackup } from "@/lib/backup-schedule";
import { addDays, AGENDA_DAYS, dayOf, isDay, monthDays, shiftMonth, type Day } from "@/lib/calendar-view";
import { periodFromParam } from "@/lib/dashboard";
import { loadDashboard } from "@/lib/dashboard-data";
import { exportFileName } from "@/lib/data-export";
import { formatShortDate } from "@/lib/dates";
import { DEMO_POSTING } from "@/lib/demo-profile";
import { env } from "@/lib/env";
import { resolveFileName } from "@/lib/file-name";
import { googleConnection } from "@/lib/google/account";
import { pullInterviewEvents, workingHours } from "@/lib/google/availability";
import { loadCalendar } from "@/lib/google/calendar-data";
import { loadConversation, loadInbox, waitingByApplication } from "@/lib/google/inbox-data";
import { loadGoogleClientConfig, redirectUri } from "@/lib/google/oauth";
import { publicOrigin } from "@/lib/google/origin";
import { dayPeriod, hourIn } from "@/lib/greeting";
import { loadJobSearchConfig, jobSearchView } from "@/lib/job-search/config";
import { COUNTRIES } from "@/lib/job-search/countries";
import { defaultSearch, latestRole, postingText, queryFromParams, viewFromParams } from "@/lib/job-search/search";
import { emailJobKey } from "@/lib/jobs/write-email";
import { refineJobKey } from "@/lib/jobs/refine";
import { regenerateUnitJob, unitJobKey } from "@/lib/jobs/regenerate-unit";
import { findUnfinishedJobs } from "@/lib/jobs/runner";
import { countSearches, listSearches, loadSearch } from "@/lib/posting-searches";
import { countPostings, listPostings } from "@/lib/postings";
import { prisma } from "@/lib/prisma";
import { loadProfile, loadProfileName } from "@/lib/profile-data";
import { refineSuggestions } from "@/lib/refine-suggestions";
import { maxPages } from "@/lib/settings";
import { loadSettings } from "@/lib/settings-data";
import { loadThemes, loadThemeUsage } from "@/lib/theme-data";
import { lastKnownTimeZone, userTimeZone } from "@/lib/time-zone";
import { availableUpdate } from "@/lib/update-check";
import { appVersion } from "@/lib/version";

export const loadersRouter = Router();

// Dashboard Loader
loadersRouter.get("/api/loaders/dashboard", async (req, res) => {
  const param = req.query.period as string | undefined;
  const date = req.query.date as string | undefined;
  const [settings, timeZone] = await Promise.all([loadSettings(), userTimeZone()]);
  const now = new Date();
  const range = periodFromParam(param) ?? settings.dashboardPeriod;
  const replies = await waitingByApplication().catch(() => undefined);
  const [figures, name] = await Promise.all([
    loadDashboard({ period: range, quietDays: settings.quietDays, timeZone, replies }),
    loadProfileName(),
  ]);

  // Calendar data
  const { timeZone: calTz } = await workingHours();
  const today = dayOf(now, calTz);
  const start = isDay(date) ? (date as Day) : today;
  const days = monthDays(start);
  const calendar = await loadCalendar([days[0], addDays(days.at(-1)!, AGENDA_DAYS - 1)]);
  const at = (day: Day) => (day.slice(0, 7) === today.slice(0, 7) ? "/" : `/?date=${day}`);

  res.json({
    figures,
    firstName: name.trim().split(/\s+/)[0] ?? "",
    period: dayPeriod(hourIn(timeZone)),
    range,
    quietDays: settings.quietDays,
    empty: figures.total === 0,
    calendar: {
      month: start,
      today,
      start,
      items: calendar.items,
      timeZone: calendar.timeZone,
      source: calendar.source,
      links: { previous: at(shiftMonth(start, -1)), next: at(shiftMonth(start, 1)), today: "/" },
    },
  });
});

// Agent Loader
loadersRouter.get("/api/loaders/agent", async (_req, res) => {
  const view = await loadAgentView();
  res.json({ view });
});

// Applications Loader
loadersRouter.get("/api/loaders/applications", async (req, res) => {
  const settings = await loadSettings();
  const params = resolveListParams(req.query as Record<string, string>, settings);
  const [all, archived] = await Promise.all([
    loadApplicationRows({ archived: params.archived, sort: params.sort }),
    prisma.application.count({ where: { archivedAt: { not: null }, awaitingReview: false } }),
  ]);
  const q = params.q.toLocaleLowerCase();
  const found = q ? all.filter((row) => `${row.company} ${row.role}`.toLocaleLowerCase().includes(q)) : all;
  const counts = {
    all: all.length,
    active: all.filter((row) => statusesIn("active").includes(row.status)).length,
    closed: all.filter((row) => statusesIn("closed").includes(row.status)).length,
  };
  const current = all.filter((row) => !row.archived);

  res.json({
    params,
    rows: found.filter((row) => statusesIn(params.filter).includes(row.status)),
    counts,
    summary: listSummary(current.map((row) => row.status)),
    empty: current.length === 0 && all.length === 0 && archived === 0,
    archivedCount: archived,
  });
});

// Single Application Loader
loadersRouter.get("/api/loaders/applications/:id", async (req, res) => {
  const { id } = req.params;
  const tab = req.query.tab as string | undefined;

  await pullInterviewEvents({ applicationId: id, signal: AbortSignal.timeout(3_000) }).catch(() => 0);

  const [
    { application, profile, settings, extracted, resume, letter, email, includeReferences, letterDate },
    aiReady,
    unitJobs,
    refineJobs,
    emailJobs,
    timeZone,
    google,
    emails,
  ] = await Promise.all([
    loadDocuments(id),
    isAiConfigured(),
    findUnfinishedJobs(unitJobKey(id)),
    findUnfinishedJobs(refineJobKey(id)),
    findUnfinishedJobs(emailJobKey(id)),
    userTimeZone(),
    googleConnection(),
    loadConversation(id),
  ]);

  const match = readJson(matchSchema, application.match);
  const messages = application.messages
    .map((message, index) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      targetUnit: message.targetUnit,
      opening: index === 0 && message.role === "AI" && !message.writtenWith,
      canUndo: message.role === "AI" && (readJson(editsSchema, message.edits)?.length ?? 0) > 0,
      undone: message.undone,
    }))
    .filter((message) => settings.showDiff || !message.opening);

  const rewriting = unitJobs.flatMap((job) => {
    const input = regenerateUnitJob.input.safeParse(job.input);
    return input.success ? [{ jobId: job.id, document: input.data.document, unitId: input.data.unitId }] : [];
  });

  const fileName = (doc: "RESUME" | "COVER_LETTER") =>
    resolveFileName(settings.fileNamePattern, {
      name: profile.basics.name,
      company: application.company,
      role: application.role,
      doc,
      date: new Date(),
    });

  res.json({
    application: {
      id,
      title: application.title,
      company: application.company,
      location: application.location,
      status: application.status,
      tone: application.tone,
      language: application.language,
      followThemeLayout: application.followThemeLayout,
      archived: application.archivedAt !== null,
      awaitingReview: application.awaitingReview,
      nextInterviewAt: application.nextInterviewAt,
    },
    timeZone,
    posting: {
      text: application.postingText,
      url: /^https?:\/\//i.test(application.postingUrl) ? application.postingUrl : "",
      pasted: formatShortDate(application.createdAt),
    },
    match,
    requirements: extracted?.requirements ?? [],
    activity: activityTimeline({ notes: application.notes, events: application.events, createdAt: application.createdAt }),
    meta: [
      application.company,
      application.role,
      application.location,
    ].filter(Boolean).join(" · "),
    resume,
    letter,
    email,
    writingEmail: emailJobs.at(-1)?.id ?? null,
    attachments: { resume: resume ? fileName("RESUME") : null, letter: letter ? fileName("COVER_LETTER") : null },
    gmail:
      google.status === "not-configured" && emails.length === 0
        ? undefined
        : {
            sender:
              google.status === "connected"
                ? google.canSend
                  ? { from: google.email }
                  : { from: null, reason: "no-permission" }
                : { from: null, reason: google.status === "not-configured" ? "not-configured" : "not-connected" },
            sentBefore: application.emailThreadId !== null,
            emails,
            reading: google.status === "connected" && google.canRead && settings.gmailRead,
          },
    profile,
    paper: settings.paper,
    dateFormat: settings.dateFormat,
    includeReferences,
    letterDate,
    score: match && match.items.length > 0 ? matchScore(match) : null,
    initialTab: tab,
    aiReady,
    rewriting,
    messages,
    refining: refineJobs.at(-1)?.id ?? null,
    suggestions: refineSuggestions({
      match,
      requirements: extracted?.requirements ?? [],
      tone: application.tone,
      hasSummary: Boolean(resume?.units.some((unit) => unit.id === "summary" && unit.text.trim())),
    }),
  });
});

// Inbox Loader
loadersRouter.get("/api/loaders/inbox", async (_req, res) => {
  const [inbox, connection, settings, aiReady, timeZone, applications] = await Promise.all([
    loadInbox(),
    googleConnection(),
    loadSettings(),
    isAiConfigured(),
    userTimeZone(),
    prisma.application.findMany({
      where: { archivedAt: null, awaitingReview: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, company: true, role: true, title: true },
    }),
  ]);
  res.json({
    inbox,
    connected: connection.status === "connected" && connection.canRead && settings.gmailRead,
    configured: connection.status !== "not-configured",
    lastSync: connection.status === "connected" ? connection.lastSyncAt : null,
    problem: connection.status === "connected" ? connection.syncProblem : null,
    aiReady,
    timeZone,
    applications: applications.map((application: { id: string; company: string; role: string; title: string }) => ({
      id: application.id,
      label: [application.company, application.role || application.title].filter(Boolean).join(", ") || "Untitled application",
    })),
  });
});

// Jobs Loader
loadersRouter.get("/api/loaders/jobs", async (req, res) => {
  const params = req.query as Record<string, string>;
  const view = viewFromParams(params);
  const typed = queryFromParams(params);
  const searchId = typeof params.search === "string" ? params.search : undefined;
  const [config, timeZone, postingCounts, searches] = await Promise.all([
    loadJobSearchConfig(),
    userTimeZone(),
    countPostings(),
    countSearches(),
  ]);
  const now = new Date();

  const search = view === "search" && !typed ? await loadSearch(searchId, { timeZone, now }) : null;
  const [kept, history] = await Promise.all([
    view === "saved" || view === "dismissed" ? listPostings(view) : undefined,
    view === "history" ? listSearches({ timeZone, now }) : undefined,
  ]);

  // Profile default search
  const [fields, experience] = await Promise.all([
    prisma.profileField.findMany({ where: { key: { in: ["city", "country"] } } }),
    prisma.experience.findMany({ select: { role: true, current: true, startYear: true, startMonth: true, endYear: true, endMonth: true } }),
  ]);
  const field = (key: string) => fields.find((entry) => entry.key === key)?.value ?? "";
  const defQuery = defaultSearch({ role: latestRole(experience), city: field("city"), country: field("country") });
  const latestQ = (await loadSearch())?.query ?? null;

  res.json({
    source: config.source,
    countries: COUNTRIES,
    view,
    query: typed ?? search?.query ?? latestQ ?? defQuery,
    search,
    missingSearch: Boolean(searchId) && !search,
    kept,
    history,
    counts: { ...postingCounts, searches },
    today: now.toISOString(),
  });
});

// New Application Loader
loadersRouter.get("/api/loaders/new", async (req, res) => {
  const fresh = req.query.fresh;
  const posting = req.query.posting as string | undefined;
  const [aiReady, applications, settings, fromFindJobs] = await Promise.all([
    isAiConfigured(),
    prisma.application.count({ where: { awaitingReview: false } }),
    loadSettings(),
    typeof posting === "string" ? prisma.posting.findUnique({ where: { id: posting } }) : null,
  ]);
  res.json({
    aiReady,
    defaultTone: settings.defaultTone,
    fresh: fresh !== undefined,
    fromPosting: fromFindJobs
      ? { id: fromFindJobs.id, text: postingText(fromFindJobs), url: fromFindJobs.url, complete: fromFindJobs.complete }
      : null,
    samplePosting: applications === 0 ? DEMO_POSTING : null,
  });
});

// Profile Loader
loadersRouter.get("/api/loaders/profile", async (req, res) => {
  const [profile, settings] = await Promise.all([loadProfile(), loadSettings()]);
  res.json({
    initial: profile,
    section: req.query.section || "contact",
    order: { experience: settings.experienceOrder, projects: settings.projectOrder, education: settings.educationOrder },
  });
});

// Resume Loader
loadersRouter.get("/api/loaders/resume", async (_req, res) => {
  const [profile, themes, settings, usage] = await Promise.all([loadProfile(), loadThemes(), loadSettings(), loadThemeUsage()]);
  res.json({
    profile,
    themes,
    usage,
    baseThemeId: settings.baseThemeId,
    paper: settings.paper,
    includeReferences: settings.includeRefs,
    language: settings.resumeLanguage,
    maxPages: maxPages(settings.pageLimit),
  });
});

// Settings Loader
loadersRouter.get("/api/loaders/settings", async (req, res) => {
  const section = (req.query.section as string) || "ai";
  const settings = await loadSettings();

  const whenRan = (date: Date | null) => (date ? formatShortDate(date) : null);

  const googleClient = await loadGoogleClientConfig();
  const conn = await googleConnection();
  const googleView = conn.status === "connected" ? { ...conn, lastSync: whenRan(conn.lastSyncAt) } : conn;

  const [name, latestApp, aiSettingsView, jobConfig, lastBackup] = await Promise.all([
    loadProfileName().catch(() => ""),
    prisma.application.findFirst({ where: { awaitingReview: false }, orderBy: { createdAt: "desc" }, select: { company: true, role: true } }),
    loadAiSettingsView(),
    loadJobSearchConfig(),
    lastNightlyBackup(),
  ]);

  const filePreviewName = resolveFileName(settings.fileNamePattern, {
    name: name.trim() || "Jane Doe",
    company: latestApp?.company || "Acme Inc.",
    role: latestApp?.role || "Software Engineer",
    doc: "RESUME" as any,
    date: new Date(),
  });

  res.json({
    section,
    settings,
    ai: {
      view: aiSettingsView,
      behaviour: { creativity: settings.creativity, strict: settings.strict, showDiff: settings.showDiff },
    },
    jobs: {
      initial: jobSearchView(jobConfig),
    },
    agent: {
      initial: {
        enabled: settings.agentEnabled,
        query: settings.agentQuery.keywords.trim() ? settings.agentQuery : ((await loadSearch())?.query ?? settings.agentQuery),
        hour: settings.agentHour,
        minScore: settings.agentMinScore,
        maxScores: settings.agentMaxScores,
        maxDrafts: settings.agentMaxDrafts,
        autoDraft: settings.agentAutoDraft,
      },
      source: jobConfig.source,
      aiReady: await isAiConfigured(),
      countries: COUNTRIES,
      timeZone: await lastKnownTimeZone(),
    },
    google: {
      connection: googleView,
      client: { id: googleClient.id, idState: googleClient.idState, secretState: googleClient.secretState },
      browserTimeZone: (await userTimeZone()) ?? null,
      redirectUri: redirectUri(publicOrigin(req)),
      initial: {
        gmailRead: settings.gmailRead,
        gmailScope: settings.gmailScope,
        gmailInterval: settings.gmailInterval,
        calendarAvailability: settings.calendarAvailability,
        calendarEvents: settings.calendarEvents,
        calendarId: settings.calendarId,
        workDays: settings.workDays,
        workStart: settings.workStart,
        workEnd: settings.workEnd,
        workTimeZone: settings.workTimeZone,
        slotMinutes: settings.slotMinutes,
        bufferMinutes: settings.bufferMinutes,
      },
    },
    data: {
      hasApiKey: [settings.apiKeyEnc, settings.jsearchKeyEnc, settings.adzunaKeyEnc].some((key) => key !== null),
      exportName: exportFileName(),
      backups: {
        on: settings.nightlyBackup,
        retentionDays: env.DOSSIER_BACKUP_RETENTION_DAYS,
        dir: backupsDir(),
        lastRun: whenRan(lastBackup),
        problem: settings.backupProblem,
      },
      jobRetentionHours: settings.jobRetentionHours,
    },
    documents: {
      initial: {
        paper: settings.paper,
        dateFormat: settings.dateFormat,
        defaultTone: settings.defaultTone,
        docLanguage: settings.docLanguage,
        resumeLanguage: settings.resumeLanguage,
        customLanguages: settings.customLanguages,
        fileNamePattern: settings.fileNamePattern,
        includeRefs: settings.includeRefs,
        pageLimit: settings.pageLimit,
      },
      preview: filePreviewName,
    },
    about: {
      facts: {
        database: "PostgreSQL",
        version: appVersion,
        node: process.version,
      },
      usagePing: {
        choice: settings.usagePingChoice,
        choiceAt: settings.usagePingChoiceAt ? formatShortDate(new Date(settings.usagePingChoiceAt)) : null,
      },
      updates: { daily: settings.updateCheck, available: availableUpdate(settings) },
    },
  });
});
