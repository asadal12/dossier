import { getRequestContext } from "@/server/context";

/**
 * The client's IP for rate limiting: the last X-Forwarded-For entry. Behind
 * a reverse proxy that appends the address it sees (like CapRover's nginx),
 * that's the real client; without one, Next.js fills the header in from the
 * socket. A client connecting directly can fake it, which is why failures are
 * also limited globally (see GLOBAL in throttle.ts).
 */
export function clientIp(headers?: Headers | { get?: (k: string) => string | null }): string {
  if (headers && typeof headers.get === "function") {
    const forwarded = headers.get("x-forwarded-for");
    const last = forwarded?.split(",").at(-1)?.trim();
    return last || "unknown";
  }
  const ctx = getRequestContext();
  if (ctx) {
    const forwarded = ctx.req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const last = forwarded.split(",").at(-1)?.trim();
      if (last) return last;
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      const last = forwarded.at(-1)?.trim();
      if (last) return last;
    }
    return ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown";
  }
  return "unknown";
}
