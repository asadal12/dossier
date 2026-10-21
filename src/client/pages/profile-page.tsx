import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { ProfileEditor } from "@/app/(app)/profile/profile-editor";
import { sectionFromParam } from "@/app/(app)/profile/sections";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function ProfilePage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/profile?${searchParams.toString()}`));
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
    return <ScreenSkeleton label="Loading your profile…" variant="form" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load profile")} retry={loadData} title="Could not load profile" />;
  }

  return (
    <ProfileEditor
      initial={data.initial}
      section={sectionFromParam(searchParams.get("section") ?? undefined)}
      order={data.order}
    />
  );
}
