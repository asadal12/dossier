export function unstable_doesMiddlewareMatch({
  config,
  url,
}: {
  config: { matcher: (string | RegExp)[] };
  nextConfig?: any;
  url: string;
}): boolean {
  const pathname = url.startsWith("http") ? new URL(url).pathname : url;
  for (const pattern of config.matcher) {
    const regex = typeof pattern === "string" ? new RegExp(`^${pattern}`) : pattern;
    if (regex.test(pathname)) return true;
  }
  return false;
}

export function getRedirectUrl(response: any): string | null {
  return response?.headers?.get?.("location") ?? null;
}
