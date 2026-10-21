import type { Request, Response, NextFunction } from "express";
import { getSession } from "@/lib/auth/session";
import { messages } from "@/lib/messages";

export async function requireAuth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await getSession();
  if (!session) {
    res.status(401).json({ error: messages.signedOut });
    return;
  }
  next();
}
