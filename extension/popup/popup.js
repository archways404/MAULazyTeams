const statusEl = document.getElementById("status");
const emailEl = document.getElementById("emailInput");
const startBtn = document.getElementById("startBtn");

function setStatus(msg) {
	statusEl.textContent = msg;
}

async function getActiveTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

function sendToBackground(message) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(message, (resp) => {
			const err = chrome.runtime.lastError;
			if (err) return reject(err);
			resolve(resp);
		});
	});
}

startBtn.addEventListener("click", async () => {
	try {
		startBtn.disabled = true;
		setStatus("Fetching data…");

		const tab = await getActiveTab();
		if (!tab?.id) throw new Error("No active tab");

		// (Optional) enforce correct site
		if (!String(tab.url || "").startsWith("https://mau.hr.evry.se/primula")) {
			throw new Error("Open Primula first: https://mau.hr.evry.se/primula");
		}

		const email = (emailEl.value || "").trim();

		// Background fetches your data (dates/hours/etc)
		const resp = await sendToBackground({
			type: "FETCH_PLAN",
			payload: { email },
		});

		if (!resp?.ok) throw new Error(resp?.error || "Fetch failed");

		setStatus("Data fetched. Starting automation…");

		// Tell content script to start
		await chrome.tabs.sendMessage(tab.id, {
			type: "MAU_START",
			payload: resp.plan,
		});

		setStatus("Started ✅ (watch page / console)");
	} catch (e) {
		setStatus(`Error: ${e?.message || String(e)}`);
	} finally {
		startBtn.disabled = false;
	}
});
