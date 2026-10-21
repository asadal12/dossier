import { requestContext } from "@/server/context";

export async function cookies() {
  const ctx = requestContext.getStore();
  return {
    get(name: string) {
      const val = ctx?.req.cookies?.[name];
      return val !== undefined ? { name, value: val } : undefined;
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      ctx?.res.cookie(name, value, options as any);
    },
    delete(name: string) {
      ctx?.res.clearCookie(name);
    },
  };
}

export async function headers() {
  const ctx = requestContext.getStore();
  const h = new Headers();
  if (ctx) {
    for (const [k, v] of Object.entries(ctx.req.headers)) {
      if (typeof v === "string") h.set(k, v);
      else if (Array.isArray(v)) h.set(k, v.join(", "));
    }
  }
  return h;
}
