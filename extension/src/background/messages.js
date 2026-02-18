import { onRuntimeMessage, sendTabMessage } from "../shared/chrome.js";
import { MSG } from "../shared/constants.js";
import { healthCheck } from "./health.js";
import { fetchPlan } from "./shiftsApi.js";

function parseMonthYear(payload) {
  const year = Number(payload?.year);
  const month = Number(payload?.month);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month/year: ${year}-${month}`);
  }
  return { year, month };
}

export function registerBackgroundHandlers() {
  onRuntimeMessage(async (msg, sender) => {
    if (msg?.type === MSG.HEALTH_CHECK) return await healthCheck();
    if (msg?.type === MSG.PRIMULA_READY) return { ok: true };

    if (msg?.type === MSG.START_FROM_PAGE) {
      const tabId = sender?.tab?.id;
      if (!tabId) throw new Error("No tab id (are you calling from a page?)");

      const email = msg.payload?.email || "";
      const { year, month } = parseMonthYear(msg.payload);

      const plan = await fetchPlan(email, year, month);

      await sendTabMessage(tabId, { type: MSG.MAU_START, payload: plan });
      return { ok: true };
    }

    if (msg?.type === MSG.RUN_PROGRESS) return { ok: true };

    return { ok: false, error: "Unknown message type" };
  });
}
