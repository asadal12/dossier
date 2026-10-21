import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response } from "express";
import type { Session } from "@/lib/auth/session";

export type RequestContext = {
  req: Request;
  res: Response;
  session?: Session | null;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
