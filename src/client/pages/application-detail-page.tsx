import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { ApplicationView } from "@/app/(app)/applications/[id]/application-view";
import { tabFrom } from "@/app/(app)/applications/[id]/tabs";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const tab = searchParams.get("tab") ?? undefined;

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/applications/${id}${tab ? `?tab=${tab}` : ""}`));
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
  }, [id]);

  if (loading && !data) {
    return <ScreenSkeleton label="Loading application…" variant="document" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load application")} retry={loadData} title="Could not load application" />;
  }

  return (
    <ApplicationView
      application={data.application}
      timeZone={data.timeZone}
      posting={data.posting}
      match={data.match}
      requirements={data.requirements}
      activity={data.activity}
      meta={data.meta}
      resume={data.resume}
      letter={data.letter}
      email={data.email}
      writingEmail={data.writingEmail}
      attachments={data.attachments}
      gmail={data.gmail}
      profile={data.profile}
      paper={data.paper}
      dateFormat={data.dateFormat}
      includeReferences={data.includeReferences}
      letterDate={data.letterDate ? new Date(data.letterDate) : new Date()}
      score={data.score}
      initialTab={tabFrom(tab)}
      aiReady={data.aiReady}
      rewriting={data.rewriting}
      messages={data.messages}
      refining={data.refining}
      suggestions={data.suggestions}
    />
  );
}
