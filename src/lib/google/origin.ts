import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { getRequestContext } from "@/server/context";

/**
 * The address the browser reaches Dossier at: DOSSIER_PUBLIC_URL, else the
 * forwarded host and protocol behind a reverse proxy, else the request's own.
 */
export function publicOrigin(request?: NextRequest | { headers: Record<string, unknown>; protocol?: string; hostname?: string }): string {
  if (env.DOSSIER_PUBLIC_URL) return env.DOSSIER_PUBLIC_URL;
  const ctx = getRequestContext();
  const req: any = request ?? ctx?.req;
  if (!req) return "http://localhost:3000";
  const getHeader = (name: string): string | undefined => {
    if (typeof req.headers?.get === "function") return req.headers.get(name) ?? undefined;
    const val = req.headers?.[name];
    return Array.isArray(val) ? val[0] : val;
  };
  const host = getHeader("x-forwarded-host")?.split(",")[0]?.trim() || getHeader("host") || req.hostname;
  const proto = getHeader("x-forwarded-proto")?.split(",")[0]?.trim() || (req.protocol ? req.protocol.replace(/:$/, "") : (req.secure ? "https" : "http"));
  return host ? `${proto}://${host}` : (req.nextUrl?.origin ?? "http://localhost:3000");
}
