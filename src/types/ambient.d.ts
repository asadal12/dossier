import type React from "react";

declare global {
  type PageProps<_T = unknown> = {
    params: Promise<Record<string, string>>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  };

  type LayoutProps<_T = unknown> = {
    children: React.ReactNode;
    params?: Promise<Record<string, string>>;
  };

  type RouteContext<_T = unknown> = {
    params: Promise<Record<string, string>>;
  };
}

export {};
