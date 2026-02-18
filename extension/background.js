import {
	combineShiftsByDay,
	filterByMonth,
	normalizeShiftsPayload,
} from "./functions/parser.js";

import { getSettings, getBaseUrl } from "./functions/settings.js"

const state = {
	primulaReady: false,
	phase: "idle", // idle | fetching | running | done | error
	message: "",
	plan: null,
};

/** Primula date field format helper (adjust if Primula expects another format) */
function toPrimulaDate(isoDate) {
	// Example: DD-MM-YYYY
	const [y, m, d] = isoDate.split("-");
	return `${y}${m}${d}`;
}

/** Convert merged+filtered shifts -> runner plan */
function makePrimulaPlanFromShifts(shifts) {
	// Sort to ensure deterministic fill order
	const sorted = [...shifts].sort((a, b) =>
		a.startDate.localeCompare(b.startDate),
	);

	const dates = sorted.map((s) => toPrimulaDate(s.startDate));
	const hours = sorted.map((s) => String(s.WorkedHours ?? ""));

	// Assumption: Primula page already has 1 row, so you need N-1 "Ny rad" clicks
	const targetClicks = Math.max(0, dates.length - 1);

	return {
		runId: String(Date.now()),
		dates,
		hours,
		compTypeValue: "0214", // your default
		delayMs: 700,
		fillDelayMs: 250,
		targetClicks,

		// optional debug
		debug: { mergedFiltered: sorted },
	};
}

function setState(patch) {
	Object.assign(state, patch);
	// if you later re-add ports/popup UI, you can broadcast here
}

async function healthCheck() {
  const settings = await getSettings();
  const baseUrl = String(getBaseUrl(settings) || "").replace(/\/+$/, "");
  if (!baseUrl) return { ok: false, baseUrl: "", message: "No baseUrl configured" };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: ctrl.signal,
      cache: "no-store",
    });

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;

    if (!res.ok) return { ok: false, baseUrl, message: `HTTP ${res.status}` };
    if (!data?.ok) return { ok: false, baseUrl, message: data?.message || "Service not ready" };

    // Optional: pass through token info for UI
    return { ok: true, baseUrl, message: "Service ready", data };
  } catch (e) {
    const m = e?.name === "AbortError" ? "Health check timeout" : "Health check failed";
    return { ok: false, baseUrl, message: m };
  } finally {
    clearTimeout(t);
  }
}

async function fetchPlan(email, year, month) {
	const settings = await getSettings();
	const baseUrl = getBaseUrl(settings);

	const ctrl = new AbortController();
	const timeoutId = setTimeout(() => ctrl.abort(), 8000);

	let res;
	try {
		const payload = {
		...(email ? { email } : {}),
		...(settings.apiKey ? { apiKey: settings.apiKey } : {}),
		};

		res = await fetch(`${baseUrl}/shifts/me`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
		signal: ctrl.signal,
		});
	} catch (e) {
		const msg =
		e?.name === "AbortError"
			? `Shifts server timed out (${baseUrl}).`
			: `Cannot reach shifts server (${baseUrl}). Is it running?`;
		throw new Error(msg);
	} finally {
		clearTimeout(timeoutId);
	}

	// parse safely (some errors return HTML/text)
	let data = {};
	const ct = res.headers.get("content-type") || "";
	if (ct.includes("application/json")) {
		data = await res.json().catch(() => ({}));
	} else {
		const text = await res.text().catch(() => "");
		data = { message: text?.slice(0, 200) };
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

	// optional: make “no shifts” a first-class error
	if (!plan.dates.length) {
		throw new Error("No shifts found for that month.");
	}

	return plan;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	(async () => {
		try {

			if (msg?.type === "HEALTH_CHECK") {
				const result = await healthCheck();
				sendResponse(result);
				return;
			}
			
			if (msg?.type === "PRIMULA_READY") {
				sendResponse?.({ ok: true });
				return;
			}



			if (msg?.type === "START_FROM_PAGE") {
				const tabId = sender?.tab?.id;
				if (!tabId) throw new Error("No tab id (are you calling from a page?)");

				const email = msg.payload?.email || "";

				// ✅ NEW: month/year (numbers)
				const year = Number(msg.payload?.year);
				const month = Number(msg.payload?.month);

				// basic guard
				if (
					!Number.isFinite(year) ||
					!Number.isFinite(month) ||
					month < 1 ||
					month > 12
				) {
					throw new Error(`Invalid month/year: ${year}-${month}`);
				}

				const plan = await fetchPlan(email, year, month);

				await chrome.tabs.sendMessage(tabId, {
					type: "MAU_START",
					payload: plan,
				});

				sendResponse({ ok: true });
				return;
			}

			if (msg?.type === "RUN_PROGRESS") {
				sendResponse?.({ ok: true });
				return;
			}
		} catch (e) {
			sendResponse({ ok: false, error: e?.message || String(e) });
		}
	})();

	return true;
});
