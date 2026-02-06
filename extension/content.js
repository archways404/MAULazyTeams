if (window.top !== window) {
	// skip iframes
} else {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	const KEY_PLAN = "__MAU_PLAN__";
	const KEY_COUNT = "__MAU_NYRAD_COUNT__";
	const KEY_DONE = "__MAU_FORM_DONE__";

	function loadPlan() {
		try {
			const raw = sessionStorage.getItem(KEY_PLAN);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}

	function savePlan(plan) {
		sessionStorage.setItem(KEY_PLAN, JSON.stringify(plan));
	}

	function getCount() {
		const n = Number.parseInt(sessionStorage.getItem(KEY_COUNT) ?? "0", 10);
		return Number.isFinite(n) ? n : 0;
	}
	function setCount(n) {
		sessionStorage.setItem(KEY_COUNT, String(n));
	}

	function isDone() {
		return sessionStorage.getItem(KEY_DONE) === "1";
	}
	function setDone() {
		sessionStorage.setItem(KEY_DONE, "1");
	}

	function findNyRadButton() {
		return document.querySelector(
			'input[type="submit"][value="Ny rad"].button.wide',
		);
	}

	async function waitForNyRad({ timeoutMs = 15000, pollMs = 250 } = {}) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const btn = findNyRadButton();
			if (btn) return btn;
			await sleep(pollMs);
		}
		return null;
	}

	function findDateInputs() {
		return Array.from(
			document.querySelectorAll('input[type="text"][title="Datum"].kalender'),
		);
	}

	function findHoursInputs() {
		return Array.from(
			document.querySelectorAll('input[type="text"][title="Antal timmar"]'),
		);
	}

	function findCompTypeSelects() {
		return Array.from(
			document.querySelectorAll('select[title="Typ av ersättning"]'),
		);
	}

	function setInputValue(el, value) {
		el.focus();
		el.value = value;
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
		el.blur();
	}

	function setSelectValue(el, value) {
		el.focus();
		el.value = value;
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
		el.blur();
	}

	async function fillRows(plan) {
		const dateInputs = findDateInputs();
		const hourInputs = findHoursInputs();
		const compSelects = findCompTypeSelects();

		const n = Math.min(
			dateInputs.length,
			hourInputs.length,
			compSelects.length,
			plan.dates.length,
			plan.hours.length,
		);

		console.log("[MAU Helper] Filling rows:", n);

		for (let i = 0; i < n; i++) {
			setInputValue(dateInputs[i], String(plan.dates[i] ?? ""));
			await sleep(plan.fillDelayMs ?? 250);

			setInputValue(hourInputs[i], String(plan.hours[i] ?? ""));
			await sleep(plan.fillDelayMs ?? 250);

			setSelectValue(compSelects[i], plan.compTypeValue ?? "0214");
			await sleep(plan.fillDelayMs ?? 250);
		}
	}

	async function runAutomationIfPlanned() {
		if (!location.href.startsWith("https://mau.hr.evry.se/primula")) return;

		const plan = loadPlan();
		if (!plan) return; // nothing scheduled
		if (isDone()) return; // already completed

		const targetClicks = Number(plan.targetClicks ?? 0);
		const delayMs = Number(plan.delayMs ?? 700);

		const count = getCount();
		console.log(
			`[MAU Helper] runId=${plan.runId} progress ${count}/${targetClicks}`,
		);

		// Phase A: click “Ny rad” across reloads
		if (count < targetClicks) {
			const btn = await waitForNyRad();
			if (!btn) {
				console.log("[MAU Helper] Ny rad button NOT found");
				return;
			}

			await sleep(delayMs);

			// increment BEFORE click (page may reload instantly)
			setCount(count + 1);

			console.log(
				`[MAU Helper] Clicking Ny rad (${count + 1}/${targetClicks})`,
			);
			btn.click();
			return;
		}

		// Phase B: fill fields once
		await sleep(700);
		await fillRows(plan);

		setDone();
		console.log("[MAU Helper] Completed ✅");
	}

	// Listen for popup start
	chrome.runtime.onMessage.addListener((msg) => {
		if (msg?.type === "MAU_START") {
			const plan = msg.payload;

			// reset progress for a fresh run
			sessionStorage.setItem(KEY_COUNT, "0");
			sessionStorage.removeItem(KEY_DONE);

			savePlan(plan);
			console.log("[MAU Helper] Plan received:", plan);

			// run immediately
			runAutomationIfPlanned();
		}
	});

	// Also continue automatically after reloads if a plan exists
	runAutomationIfPlanned();
}
