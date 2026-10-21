import { Router } from "express";
import { logServerError } from "@/lib/log";
import { messages } from "@/lib/messages";

export const actionsRouter = Router();

actionsRouter.post("/api/actions/:actionKey(*)", async (req, res) => {
  const { actionKey } = req.params;
  const lastDot = actionKey.lastIndexOf(".");
  if (lastDot === -1) {
    res.status(404).json({ ok: false, error: "Invalid action path" });
    return;
  }

  const filePath = actionKey.slice(0, lastDot);
  const exportName = actionKey.slice(lastDot + 1);

  if (!filePath.endsWith("actions")) {
    res.status(403).json({ ok: false, error: "Forbidden action file" });
    return;
  }

  try {
    const mod = await import(`@/${filePath}`);
    const actionFn = mod[exportName];
    if (typeof actionFn !== "function") {
      res.status(404).json({ ok: false, error: `Action ${exportName} not found` });
      return;
    }

    const result = await actionFn(req.body);
    res.json(result);
  } catch (error) {
    logServerError(`action ${actionKey}`, error);
    res.json({ ok: false, error: messages.unexpected });
  }
});
