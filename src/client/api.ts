import type { ActionResult } from "@/lib/action";
import { withBasePath } from "@/lib/base-path";

export function apiUrl(path: string): string {
  return withBasePath(path);
}

export function clientAction<Input = unknown, Output = unknown>(actionPath: string) {
  return async (input?: Input): Promise<ActionResult<Output>> => {
    try {
      const res = await fetch(apiUrl(`/api/actions/${encodeURIComponent(actionPath)}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input ?? {}),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.error || `Server error (${res.status})`,
        };
      }

      return await res.json();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Network error. Please try again.",
      };
    }
  };
}
