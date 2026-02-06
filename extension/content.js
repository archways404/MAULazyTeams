// content.js
// Only run in top frame (avoid iframes)
if (window.top !== window) {
	// skip
} else {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	// === CONFIG ===
	const TARGET_CLICKS = 3; // how many "Ny rad" rows to create
	const DELAY_MS = 700; // delay before clicking Ny rad
	const FILL_DELAY_MS = 250; // delay between field fills

	const DATES = ["20260204", "20260208", "20260212"]; // per row
	const HOURS = ["3", "3", "3"]; // per row
	const COMP_TYPE_VALUE = "0214"; // "Timlön"

	// === STORAGE KEYS (survive reload in same tab) ===
	const KEY_COUNT = "__MAU_HELPER_NYRAD_COUNT__";
	const KEY_FORM_DONE = "__MAU_HELPER_FORM_DONE__";

	function getCount() {
		const n = Number.parseInt(sessionStorage.getItem(KEY_COUNT) ?? "0", 10);
		return Number.isFinite(n) ? n : 0;
	}
	function setCount(n) {
		sessionStorage.setItem(KEY_COUNT, String(n));
	}

	function formDone() {
		return sessionStorage.getItem(KEY_FORM_DONE) === "1";
	}
	function setFormDone() {
		sessionStorage.setItem(KEY_FORM_DONE, "1");
	}

	// === FINDERS ===
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
		// Title + class (id changes)
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

	// === SETTERS ===
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

	async function fillRows({ dates, hours, compTypeValue }, delayMs = 200) {
		const dateInputs = findDateInputs();
		const hourInputs = findHoursInputs();
		const compSelects = findCompTypeSelects();

		console.log("[MAU Helper] Fields found:", {
			dates: dateInputs.length,
			hours: hourInputs.length,
			compTypes: compSelects.length,
		});

		const n = Math.min(
			dateInputs.length,
			hourInputs.length,
			compSelects.length,
			dates.length,
		);

		if (n <= 0) {
			console.log("[MAU Helper] Nothing to fill (n=0).");
			return;
		}

		for (let i = 0; i < n; i++) {
			console.log(`[MAU Helper] Filling row ${i + 1}/${n}`);

			setInputValue(dateInputs[i], String(dates[i] ?? ""));
			await sleep(delayMs);

			setInputValue(hourInputs[i], String(hours[i] ?? ""));
			await sleep(delayMs);

			setSelectValue(compSelects[i], compTypeValue);
			await sleep(delayMs);
		}

		console.log("[MAU Helper] Done filling rows.");
	}

	(async () => {
		if (!location.href.startsWith("https://mau.hr.evry.se/primula")) return;

		const count = getCount();
		console.log(`[MAU Helper] Loaded. Progress ${count}/${TARGET_CLICKS}`);

		// === Phase A: create rows by clicking "Ny rad" across reloads ===
		if (count < TARGET_CLICKS) {
			const btn = await waitForNyRad();
			if (!btn) {
				console.log("[MAU Helper] Ny rad button NOT found");
				return;
			}

			await sleep(DELAY_MS);

			// increment BEFORE click because click may reload instantly
			setCount(count + 1);

			console.log(
				`[MAU Helper] Clicking Ny rad (${count + 1}/${TARGET_CLICKS})`,
			);
			btn.click();
			return; // next reload continues
		}

		// === Phase B: fill fields once ===
		if (!formDone()) {
			// let page settle a bit
			await sleep(700);

			await fillRows(
				{
					dates: DATES,
					hours: HOURS,
					compTypeValue: COMP_TYPE_VALUE,
				},
				FILL_DELAY_MS,
			);

			setFormDone();
			console.log("[MAU Helper] Form filled (marked done).");
		} else {
			console.log("[MAU Helper] Form already filled; skipping.");
		}
	})();
}
