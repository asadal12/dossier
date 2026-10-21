import React, { useEffect, useState } from "react";
import { apiUrl } from "@/client/api";

import { ResumeWorkspace } from "@/app/(app)/resume/resume-workspace";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function ResumePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/loaders/resume"));
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
    return <ScreenSkeleton label="Loading base resume…" variant="document" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load base resume")} retry={loadData} title="Could not load base resume" />;
  }

  return (
    <ResumeWorkspace
      profile={data.profile}
      themes={data.themes}
      usage={data.usage}
      baseThemeId={data.baseThemeId}
      paper={data.paper}
      includeReferences={data.includeReferences}
      language={data.language}
      maxPages={data.maxPages}
    />
  );
}
