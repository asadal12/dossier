export function createProxy(_options?: unknown): unknown {
  return null;
}

export function getRedirectUrl(response: any): string | null {
  return response?.headers?.get?.("location") ?? null;
}

export function unstable_doesMiddlewareMatch(options: {
  config?: { matcher?: string[] };
  nextConfig?: any;
  url: string;
}): boolean {
  const matchers = options.config?.matcher ?? [];
  const url = options.url.startsWith("http") ? new URL(options.url).pathname : options.url;
  for (const pattern of matchers) {
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(url)) return true;
  }
  return false;
}
