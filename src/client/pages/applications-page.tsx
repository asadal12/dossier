import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { ApplicationsScreen } from "@/app/(app)/applications/applications-screen";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function ApplicationsPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/applications?${searchParams.toString()}`));
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
    return <ScreenSkeleton label="Loading your applications…" variant="list" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load applications")} retry={loadData} title="Could not load applications" />;
  }

  return (
    <ApplicationsScreen
      params={data.params}
      rows={data.rows}
      counts={data.counts}
      summary={data.summary}
      empty={data.empty}
      archivedCount={data.archivedCount}
    />
  );
}
