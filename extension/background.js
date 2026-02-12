import {
	combineShiftsByDay,
	filterByMonth,
	normalizeShiftsPayload,
} from "./functions/parser.js";

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

async function fetchPlan(email, year, month) {
	const res = await fetch("http://localhost:4007/shifts/me", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(email ? { email } : {}),
	});

	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.message || `API error ${res.status}`);

	const normalized = normalizeShiftsPayload(data);
	const merged = combineShiftsByDay(normalized, { mergeTitles: true });
	const mergedFiltered = filterByMonth(merged, year, month);

	const plan = makePrimulaPlanFromShifts(mergedFiltered);

	// If you still want to keep raw for debugging:
	plan.apiDataRaw = data;
	plan.apiMergedFiltered = mergedFiltered;

	return plan;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	(async () => {
		try {
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
