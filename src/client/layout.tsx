import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "@/app/(app)/sidebar";
import { UsagePingDialog } from "@/app/(app)/usage-ping-dialog";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { parseSidebarCollapsed, SIDEBAR_COOKIE } from "@/lib/ui-preferences";
import { useAuth } from "./context/auth";

export function AppLayout() {
  const { loading, authenticated, user } = useAuth();
  const location = useLocation();

  const getCookie = (name: string) => {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : undefined;
  };

  const collapsed = parseSidebarCollapsed(getCookie(SIDEBAR_COOKIE));

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <ScreenSkeleton label="Loading" variant="dashboard" />
      </div>
    );
  }

  if (!authenticated) {
    const next = location.pathname !== "/" ? `?next=${encodeURIComponent(location.pathname + location.search)}` : "";
    return <Navigate to={`/login${next}`} replace />;
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="fixed top-3 left-3 z-50 -translate-y-[200%] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:text-on-primary focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar
        userName={user?.userName ?? "New user"}
        update={user?.update ?? null}
        currentVersion={user?.currentVersion ?? "1.8.0"}
        collapsed={collapsed}
        counts={user?.counts}
      />
      <main id="main" className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      {user?.showUsagePing && <UsagePingDialog host={window.location.host} />}
    </div>
  );
}
