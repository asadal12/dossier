import React, { useEffect, useState } from "react";
import { apiUrl } from "@/client/api";

import { AgentScreen } from "@/app/(app)/agent/agent-screen";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function AgentPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/loaders/agent"));
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
  }, []);

  if (loading && !data) {
    return <ScreenSkeleton label="Loading job agent…" variant="list" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load job agent")} retry={loadData} title="Could not load job agent" />;
  }

  return <AgentScreen view={data.view} />;
}
