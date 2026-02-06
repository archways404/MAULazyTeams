const state = {
	primulaReady: false,
	phase: "idle", // idle | fetching | running | done | error
	message: "",
	plan: null,
};

function setState(patch) {
	Object.assign(state, patch);
	// if you later re-add ports/popup UI, you can broadcast here
}

async function fetchPlan(email) {
	const res = await fetch("http://localhost:4007/shifts/me", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(email ? { email } : {}),
	});

	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.message || `API error ${res.status}`);

	// TODO: map real response -> plan for your content runner
	return {
		runId: String(Date.now()),
		// put whatever your runner expects here
	};
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	(async () => {
		try {
			if (msg?.type === "PRIMULA_READY") {
				setState({ primulaReady: true, message: "Primula ready." });
				sendResponse?.({ ok: true });
				return;
			}

			if (msg?.type === "START_FROM_PAGE") {
				const tabId = sender?.tab?.id;
				if (!tabId) throw new Error("No tab id (are you calling from a page?)");

				const email = msg.payload?.email || "";

				setState({ phase: "fetching", message: "Fetching plan…" });

				const plan = await fetchPlan(email);

				setState({ plan, phase: "running", message: "Starting…" });

				// Hand off to your content runner
				await chrome.tabs.sendMessage(tabId, {
					type: "MAU_START",
					payload: plan,
				});

				setState({ phase: "running", message: "Started." });

				sendResponse({ ok: true });
				return;
			}

			// If you still want progress reporting later:
			if (msg?.type === "RUN_PROGRESS") {
				setState({
					phase: msg.payload?.phase || state.phase,
					message: msg.payload?.message || state.message,
				});
				sendResponse?.({ ok: true });
				return;
			}
		} catch (e) {
			setState({ phase: "error", message: e?.message || String(e) });
			sendResponse({ ok: false, error: e?.message || String(e) });
		}
	})();

	return true; // async
});
