import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "@/client/api";

import { CalendarCard } from "@/app/(app)/calendar-card";
import { Dashboard } from "@/app/(app)/dashboard";
import { ScreenError } from "@/components/screen-error";
import { ScreenSkeleton } from "@/components/screen-skeleton";

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/loaders/dashboard?${searchParams.toString()}`));
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
    return <ScreenSkeleton label="Loading your dashboard…" variant="dashboard" />;
  }

  if (error || !data) {
    return <ScreenError error={error || new Error("Failed to load dashboard")} retry={loadData} title="Could not load dashboard" />;
  }

  const { figures, firstName, period, range, quietDays, empty, calendar } = data;

  return (
    <Dashboard
      figures={figures}
      firstName={firstName}
      period={period}
      range={range}
      quietDays={quietDays}
      empty={empty}
      calendar={
        <CalendarCard
          key={calendar.start}
          month={calendar.month}
          today={calendar.today}
          start={calendar.start}
          items={calendar.items}
          timeZone={calendar.timeZone}
          source={calendar.source}
          links={calendar.links}
        />
      }
    />
  );
}
