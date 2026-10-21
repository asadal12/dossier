/**
 * Normalizes the base path for subpath deployments (e.g., /job).
 * Returns "" for root deployments, or "/job" (without trailing slash) for subpaths.
 */
export function getBasePath(): string {
  if (typeof process !== "undefined" && process.env?.BASE_PATH) {
    const raw = process.env.BASE_PATH.trim();
    if (!raw || raw === "/") return "";
    return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
  }

  // Vite browser environment
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.BASE_URL) {
    const raw = (import.meta as any).env.BASE_URL;
    if (!raw || raw === "/") return "";
    return raw.startsWith("/") ? raw.replace(/\/+$/, "") : `/${raw.replace(/\/+$/, "")}`;
  }

  return "";
}

/**
 * Prepends the base path to an absolute application path.
 * e.g., withBasePath("/api/auth/session") -> "/job/api/auth/session" (when BASE_PATH=/job)
 * or "/api/auth/session" (when at root).
 */
export function withBasePath(path: string): string {
  const base = getBasePath();
  if (!base) return path;
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}
