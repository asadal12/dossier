export class NextRequest extends Request {
  nextUrl: URL;
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString());
  }
  get cookies() {
    const cookieHeader = this.headers.get("cookie") || "";
    const parsed: Record<string, string> = {};
    for (const part of cookieHeader.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k) parsed[k] = v.join("=");
    }
    return {
      get: (name: string) => {
        const val = parsed[name];
        return val !== undefined ? { name, value: val } : undefined;
      },
      set: (_name: string, _value: string, _options?: Record<string, unknown>) => {},
      delete: (_name: string) => {},
    };
  }
}

export class NextResponse extends Response {
  static override json(body: any, init?: ResponseInit): NextResponse {
    return Response.json(body, init) as NextResponse;
  }
  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse {
    const status = typeof init === "number" ? init : (init?.status ?? 307);
    return new Response(null, {
      status,
      headers: { Location: typeof url === "string" ? url : url.toString() },
    }) as NextResponse;
  }
  static next(init?: { request?: { headers?: Headers | Record<string, string> }; headers?: Headers | Record<string, string> }): NextResponse {
    const headers = new Headers(init?.headers);
    headers.set("x-middleware-next", "1");
    if (init?.request?.headers) {
      const reqHeaders = new Headers(init.request.headers);
      reqHeaders.forEach((val, key) => {
        headers.set(`x-middleware-request-${key}`, val);
      });
    }
    return new Response(null, { headers }) as NextResponse;
  }
  get cookies() {
    return {
      get(_name: string) {
        return undefined as { name: string; value: string } | undefined;
      },
      set(_name: string, _value: string, _options?: Record<string, unknown>) {},
      delete(_name: string) {},
    };
  }
}

export function after(fn: () => void | Promise<void>): void {
  setImmediate(() => {
    void fn();
  });
}

export function connection(): Promise<void> {
  return Promise.resolve();
}
