const statusEl = document.getElementById("status");
const emailEl = document.getElementById("emailInput");
const startBtn = document.getElementById("startBtn");

const port = chrome.runtime.connect({ name: "ui" });

function setStatus(msg) {
	statusEl.textContent = msg;
}

port.onMessage.addListener((msg) => {
	if (msg?.type !== "STATE") return;

	const s = msg.payload;
	// show shared state from background
	setStatus(`${s.phase}: ${s.message}`);

	// optional: disable button while running/fetching
	startBtn.disabled = s.phase === "fetching" || s.phase === "running";
});

startBtn.addEventListener("click", () => {
	const email = (emailEl.value || "").trim();
	port.postMessage({ type: "START_RUN", payload: { email } });
});
