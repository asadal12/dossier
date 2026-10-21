import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { getBasePath } from "@/lib/base-path";
import { AppLayout } from "./layout";
import { AgentPage } from "./pages/agent-page";
import { ApplicationDetailPage } from "./pages/application-detail-page";
import { ApplicationsPage } from "./pages/applications-page";
import { DashboardPage } from "./pages/dashboard-page";
import { InboxPage } from "./pages/inbox-page";
import { JobsPage } from "./pages/jobs-page";
import { LoginPage } from "./pages/login-page";
import { NewApplicationPage } from "./pages/new-application-page";
import { NotFoundPage } from "./pages/not-found-page";
import { ProfilePage } from "./pages/profile-page";
import { ResumePage } from "./pages/resume-page";
import { SettingsPage } from "./pages/settings-page";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/calendar",
    element: <Navigate to="/" replace />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "agent",
        element: <AgentPage />,
      },
      {
        path: "applications",
        element: <ApplicationsPage />,
      },
      {
        path: "applications/:id",
        element: <ApplicationDetailPage />,
      },
      {
        path: "inbox",
        element: <InboxPage />,
      },
      {
        path: "jobs",
        element: <JobsPage />,
      },
      {
        path: "new",
        element: <NewApplicationPage />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "resume",
        element: <ResumePage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
], {
  basename: getBasePath() || undefined,
});
