import { getSettings, getBaseUrl } from "../shared/settings.js";
import { fetchJson } from "../shared/http.js";
import {
  combineShiftsByDay,
  filterByMonth,
  normalizeShiftsPayload,
} from "../functions/parser.js";
import { makePrimulaPlanFromShifts } from "./plan.js";

export async function fetchPlan(email, year, month) {
  const settings = await getSettings();
  const baseUrl = getBaseUrl(settings);

  const payload = {
    ...(email ? { email } : {}),
    ...(settings.apiKey ? { apiKey: settings.apiKey } : {}),
  };

  let res, data;
  try {
    ({ res, data } = await fetchJson(`${baseUrl}/shifts/me`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: 8000,
    }));
  } catch (e) {
    const msg =
      e?.name === "AbortError"
        ? `Shifts server timed out (${baseUrl}).`
        : `Cannot reach shifts server (${baseUrl}). Is it running?`;
    throw new Error(msg);
  }

  if (!res.ok) {
    const detail = data?.message ? `: ${data.message}` : "";
    throw new Error(`API error ${res.status}${detail}`);
  }

  const normalized = normalizeShiftsPayload(data);
  const merged = combineShiftsByDay(normalized, { mergeTitles: true });
  const mergedFiltered = filterByMonth(merged, year, month);

  const plan = makePrimulaPlanFromShifts(mergedFiltered);
  plan.apiDataRaw = data;
  plan.apiMergedFiltered = mergedFiltered;

  if (!plan.dates.length) throw new Error("No shifts found for that month.");
  return plan;
}
