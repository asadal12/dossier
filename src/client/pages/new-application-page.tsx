import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { NewApplication } from "@/app/(app)/new/new-application";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function NewApplicationPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/new?${searchParams.toString()}`));
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
    return <ScreenSkeleton label="Loading new application…" variant="form" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load new application")} retry={loadData} title="Could not start new application" />;
  }

  return (
    <NewApplication
      aiReady={data.aiReady}
      defaultTone={data.defaultTone}
      fresh={data.fresh}
      fromPosting={data.fromPosting}
      samplePosting={data.samplePosting}
    />
  );
}
