import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { AboutSection } from "@/app/(app)/settings/about-section";
import { AgentSection } from "@/app/(app)/settings/agent-section";
import { AiBehaviour } from "@/app/(app)/settings/ai-behaviour";
import { AiProviderSection } from "@/app/(app)/settings/ai-provider-section";
import { DataSection } from "@/app/(app)/settings/data-section";
import { DocumentsSection } from "@/app/(app)/settings/documents-section";
import { GoogleNotice } from "@/app/(app)/settings/google-notice";
import { GoogleSection } from "@/app/(app)/settings/google-section";
import { JobSearchSection } from "@/app/(app)/settings/job-search-section";
import { settingsSectionFromParam } from "@/app/(app)/settings/sections";
import { SettingsScreen } from "@/app/(app)/settings/settings-screen";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const section = settingsSectionFromParam(searchParams.get("section") ?? undefined);
  const googleOutcome = searchParams.get("google");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/settings?section=${section}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [section]);

  if (loading && !data) {
    return <ScreenSkeleton label="Loading settings…" variant="form" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load settings")} retry={loadData} title="Could not load settings" />;
  }

  return (
    <SettingsScreen section={section}>
      {section === "ai" ? (
        <>
          <AiProviderSection initial={data.ai.view} />
          <AiBehaviour initial={data.ai.behaviour} />
        </>
      ) : section === "jobs" ? (
        <JobSearchSection initial={data.jobs.initial} />
      ) : section === "agent" ? (
        <AgentSection
          initial={data.agent.initial}
          source={data.agent.source}
          aiReady={data.agent.aiReady}
          countries={data.agent.countries}
          timeZone={data.agent.timeZone}
        />
      ) : section === "google" ? (
        <>
          <GoogleNotice outcome={googleOutcome} />
          <GoogleSection
            connection={data.google.connection}
            client={data.google.client}
            browserTimeZone={data.google.browserTimeZone}
            redirectUri={data.google.redirectUri}
            initial={data.google.initial}
          />
        </>
      ) : section === "data" ? (
        <DataSection
          hasApiKey={data.data.hasApiKey}
          exportName={data.data.exportName}
          backups={data.data.backups}
          jobRetentionHours={data.data.jobRetentionHours}
        />
      ) : section === "documents" ? (
        <DocumentsSection initial={data.documents.initial} preview={data.documents.preview} />
      ) : (
        <AboutSection facts={data.about.facts} usagePing={data.about.usagePing} updates={data.about.updates} />
      )}
    </SettingsScreen>
  );
}
