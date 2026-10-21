import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { JobsScreen } from "@/app/(app)/jobs/jobs-screen";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function JobsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/jobs?${searchParams.toString()}`));
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
  }, [searchParams.toString()]);

  if (loading && !data) {
    return <ScreenSkeleton label="Loading jobs…" variant="list" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load jobs")} retry={loadData} title="Could not load jobs" />;
  }

  return (
    <JobsScreen
      source={data.source}
      countries={data.countries}
      view={data.view}
      query={data.query}
      search={data.search}
      missingSearch={data.missingSearch}
      kept={data.kept}
      history={data.history}
      counts={data.counts}
      today={data.today}
    />
  );
}
