import * as React from "react";
import {
  UNSAFE_LocationContext,
  UNSAFE_NavigationContext,
} from "react-router-dom";

export function useRouter() {
  const navCtx = React.useContext(UNSAFE_NavigationContext);
  return React.useMemo(() => {
    const navigator = navCtx?.navigator;
    return {
      push: (href: string, _options?: Record<string, unknown>) => {
        if (navigator) {
          navigator.push(href);
        } else if (typeof window !== "undefined") {
          window.location.assign(href);
        }
      },
      replace: (href: string, _options?: Record<string, unknown>) => {
        if (navigator) {
          navigator.replace(href);
        } else if (typeof window !== "undefined") {
          window.location.replace(href);
        }
      },
      back: () => {
        if (navigator) {
          navigator.go(-1);
        } else if (typeof window !== "undefined") {
          window.history.back();
        }
      },
      forward: () => {
        if (navigator) {
          navigator.go(1);
        } else if (typeof window !== "undefined") {
          window.history.forward();
        }
      },
      refresh: () => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      },
    };
  }, [navCtx]);
}

export function usePathname(): string {
  const locCtx = React.useContext(UNSAFE_LocationContext);
  if (locCtx && locCtx.location) {
    return locCtx.location.pathname;
  }
  if (typeof window !== "undefined") {
    return window.location.pathname;
  }
  return "/";
}

export function useSearchParams(): URLSearchParams {
  const locCtx = React.useContext(UNSAFE_LocationContext);
  if (locCtx && locCtx.location) {
    return new URLSearchParams(locCtx.location.search);
  }
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}

import { withBasePath } from "@/lib/base-path";

export function redirect(url: string): never {
  if (typeof window !== "undefined") {
    window.location.href = withBasePath(url);
  }
  const error = new Error(`NEXT_REDIRECT`);
  (error as any).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw error;
}

export function notFound(): never {
  const error = new Error("NEXT_NOT_FOUND");
  (error as any).digest = "NEXT_NOT_FOUND";
  throw error;
}

export function unstable_rethrow(error: unknown): void {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as any).digest === "string"
  ) {
    const digest = (error as any).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
  }
}
