import type { Request, Response, NextFunction } from "express";
import { messages } from "@/lib/messages";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestHost(req: Request): string | undefined {
  const forwarded = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  return (forwarded || req.headers.host)?.toLowerCase();
}

export function isSameOrigin(req: Request): boolean {
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

  const origin = req.headers.origin;
  if (!origin) return SAFE_METHODS.has(req.method);

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost.toLowerCase() === requestHost(req);
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  );
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  if (proto === "https" || req.secure) {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  }
  next();
}

export function sameOriginProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!isSameOrigin(req)) {
    res.status(403).json({ error: messages.crossOrigin });
    return;
  }
  next();
}

export function privateNoStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "private, no-store");
  next();
}
