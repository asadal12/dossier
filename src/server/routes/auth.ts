import { Router } from "express";
import { signIn } from "@/app/login/actions";
import { endSession, getSession } from "@/lib/auth/session";
import { countAgentQueue } from "@/lib/agent/view";
import { inboxCount } from "@/lib/google/inbox-data";
import { loadProfileName } from "@/lib/profile-data";
import { loadSettings } from "@/lib/settings-data";
import { checkForUpdatesDaily, updateNotice } from "@/lib/update-check";
import { askForUsagePing, notePageLoad } from "@/lib/usage-ping";
import { appVersion } from "@/lib/version";

export const authRouter = Router();

authRouter.post("/api/auth/sign-in", async (req, res) => {
  const result = await signIn(req.body);
  res.json(result);
});

authRouter.post("/api/auth/sign-out", async (_req, res) => {
  await endSession();
  res.json({ ok: true });
});

authRouter.get("/api/auth/session", async (_req, res) => {
  const session = await getSession();
  if (!session) {
    res.json({ authenticated: false, session: null });
    return;
  }

  // Background side-effects after authenticated requests
  void notePageLoad();
  void checkForUpdatesDaily();

  const [name, settings, waiting, agent] = await Promise.all([
    loadProfileName().catch(() => ""),
    loadSettings().catch(() => ({} as any)),
    inboxCount().catch(() => 0),
    countAgentQueue().catch(() => 0),
  ]);

  const userName = name.trim() || "New user";
  const update = updateNotice(settings);
  const showUsagePing = askForUsagePing(settings);

  res.json({
    authenticated: true,
    session,
    user: {
      userName,
      currentVersion: appVersion,
      update,
      counts: {
        ...(waiting > 0 ? { "/inbox": waiting } : {}),
        ...(agent > 0 ? { "/agent": agent } : {}),
      },
      showUsagePing,
    },
  });
});
