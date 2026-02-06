chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	(async () => {
		if (message?.type !== "FETCH_PLAN") return;

		const email = message.payload?.email || "";

		try {
			// --- Replace this with your real API call ---
			// Example: fetch plan from your Fastify server
			// const res = await fetch("http://127.0.0.1:3000/plan", { ... })

			const res = await fetch("http://192.168.100.200:4007/shifts/me", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(email ? { email } : {}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || `API error ${res.status}`);

			// TODO: transform your API response into what content.js needs.
			// For now: dummy plan (you will replace these arrays)
			const plan = {
				runId: String(Date.now()),
				targetClicks: 3,
				delayMs: 700,
				fillDelayMs: 250,
				compTypeValue: "0214",
				dates: ["20260204", "20260208", "20260212"],
				hours: ["3", "3", "3"],
			};

			sendResponse({ ok: true, plan });
		} catch (e) {
			sendResponse({ ok: false, error: e?.message || String(e) });
		}
	})();

	return true; // async
});
