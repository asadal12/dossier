import { Router } from "express";

import { getSession } from "@/lib/auth/session";
import { loadGoogleAccount, saveGoogleAccount } from "@/lib/google/account";
import { GoogleError } from "@/lib/google/errors";
import { authorizeUrl, emailFromIdToken, exchangeCode, googleClient, redirectUri, SCOPES, signState, verifyState, type ScopeGroup } from "@/lib/google/oauth";
import { publicOrigin } from "@/lib/google/origin";
import { logServerError } from "@/lib/log";

export const googleRouter = Router();

const GROUPS: readonly ScopeGroup[] = ["send", "read", "calendar"];

// GET /api/google/connect
googleRouter.get("/api/google/connect", async (req, res) => {
  const client = await googleClient();
  const origin = publicOrigin(req);
  const settingsUrl = new URL("/settings?section=google", origin);

  if (!client) {
    settingsUrl.searchParams.set("google", "not-configured");
    res.redirect(settingsUrl.toString());
    return;
  }

  const askedParam = req.query.scopes as string | undefined;
  const asked = (askedParam ?? GROUPS.join(","))
    .split(",")
    .filter((group): group is ScopeGroup => (GROUPS as readonly string[]).includes(group));

  const account = await loadGoogleAccount();
  const scopes = [
    ...SCOPES.identity,
    ...(account?.scopes.split(/\s+/) ?? []),
    ...asked.flatMap((group) => SCOPES[group]),
  ].filter(Boolean);

  const state = await signState("/settings?section=google");
  const url = authorizeUrl({ clientId: client.id, redirect: redirectUri(origin), state, scopes });
  res.redirect(url);
});

// GET /api/google/callback
googleRouter.get("/api/google/callback", async (req, res) => {
  const origin = publicOrigin(req);
  const back = (outcome: string) => {
    const url = new URL("/settings?section=google", origin);
    url.searchParams.set("google", outcome);
    res.setHeader("Cache-Control", "private, no-store");
    res.redirect(url.toString());
  };

  if (!(await getSession())) {
    res.redirect(new URL("/login", origin).toString());
    return;
  }

  const state = req.query.state as string | undefined;
  if (!(await verifyState(state ?? null))) {
    back("expired");
    return;
  }

  if (req.query.error) {
    back(req.query.error === "access_denied" ? "denied" : "failed");
    return;
  }

  const code = req.query.code as string | undefined;
  if (!code) {
    back("failed");
    return;
  }

  try {
    const tokens = await exchangeCode(code, redirectUri(origin));
    const email = emailFromIdToken(tokens.id_token);
    if (!email) {
      back("failed");
      return;
    }
    await saveGoogleAccount({ email, refreshToken: tokens.refresh_token, scopes: tokens.scope });
    back("connected");
  } catch (error) {
    if (!(error instanceof GoogleError)) logServerError("google callback", error);
    back(error instanceof GoogleError && error.problem === "rejected" ? "rejected" : "failed");
  }
});
