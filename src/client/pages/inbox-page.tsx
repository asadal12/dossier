import React, { useEffect, useState } from "react";
import { apiUrl } from "@/client/api";

import { InboxScreen } from "@/app/(app)/inbox/inbox-screen";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function InboxPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/loaders/inbox"));
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
    return <ScreenSkeleton label="Loading your inbox…" variant="list" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load inbox")} retry={loadData} title="Could not load inbox" />;
  }

  return (
    <InboxScreen
      inbox={data.inbox}
      connected={data.connected}
      configured={data.configured}
      lastSync={data.lastSync}
      problem={data.problem}
      aiReady={data.aiReady}
      timeZone={data.timeZone}
      applications={data.applications}
    />
  );
}
