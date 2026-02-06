// content.js
if (window.top !== window) {
	// skip iframes
} else {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	const KEY_PLAN = "__MAU_PLAN__";
	const KEY_COUNT = "__MAU_NYRAD_COUNT__";
	const KEY_DONE = "__MAU_FORM_DONE__";
	const KEY_READY_SENT = "__MAU_READY_SENT__";

	function readySent() {
		return sessionStorage.getItem(KEY_READY_SENT) === "1";
	}
	function setReadySent() {
		sessionStorage.setItem(KEY_READY_SENT, "1");
	}

	function hasNyRad() {
		return !!document.querySelector(
			'input[type="submit"][value="Ny rad"].button.wide',
		);
	}

	// ---------- inject "USE MAUHELPER" next to first select ----------
	function getAnchorSelect() {
		return document.querySelector('select[title="Typ av ersättning"]');
	}

	function injectUseButton() {
		if (document.getElementById("mauhelper-btn")) return;

		const sel = getAnchorSelect();
		if (!sel) return;

		const btn = document.createElement("button");
		btn.id = "mauhelper-btn";
		btn.type = "button";
		btn.textContent = "USE MAUHELPER";
		btn.style.cssText = `
      margin-left: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font-weight: 700;
      border-radius: 8px;
      border: 1px solid #444;
      background: #111;
      color: #fff;
    `;

		btn.addEventListener("click", showModal);

		sel.insertAdjacentElement("afterend", btn);
		console.log("[MAU Helper] Injected USE MAUHELPER button");
	}

	// ---------- modal UI ----------
	function ensureModal() {
		if (document.getElementById("mauhelper-modal")) return;

		const wrap = document.createElement("div");
		wrap.id = "mauhelper-modal";
		wrap.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 999999;
      width: 340px; background: #111; color: #fff;
      border: 1px solid #333; border-radius: 12px;
      padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.45);
      font-family: system-ui, sans-serif;
      display: none;
    `;

		wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:800;">MAU Helper</div>
        <button id="mh-close"
          style="background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;">✕</button>
      </div>

      <div style="margin-top:10px;">
        <input id="mh-email" placeholder="Email (optional)"
          style="width:100%;padding:8px;border-radius:10px;border:1px solid #444;background:#0b0b0b;color:#fff;" />

        <button id="mh-start"
          style="margin-top:10px;width:100%;padding:10px;border-radius:10px;border:none;cursor:pointer;font-weight:800;">
          Fetch + Start
        </button>

        <div id="mh-status"
          style="margin-top:10px;font-size:12px;opacity:.9;white-space:pre-wrap;"></div>
      </div>
    `;

		document.body.appendChild(wrap);

		wrap.querySelector("#mh-close").addEventListener("click", () => {
			wrap.style.display = "none";
		});

		wrap.querySelector("#mh-start").addEventListener("click", async () => {
			const status = wrap.querySelector("#mh-status");
			const btn = wrap.querySelector("#mh-start");
			const email = wrap.querySelector("#mh-email").value.trim();

			btn.disabled = true;
			status.textContent = "Fetching plan…";

			chrome.runtime.sendMessage(
				{ type: "START_FROM_PAGE", payload: { email } },
				(resp) => {
					const err = chrome.runtime.lastError;
					if (err) {
						status.textContent = `Error: ${err.message}`;
						btn.disabled = false;
						return;
					}
					if (!resp?.ok) {
						status.textContent = `Error: ${resp?.error || "Unknown"}`;
						btn.disabled = false;
						return;
					}
					status.textContent = "Started ✅ (watch page / console)";
					btn.disabled = false;
				},
			);
		});
	}

	function showModal() {
		ensureModal();
		document.getElementById("mauhelper-modal").style.display = "block";
	}

	// ---------- runner plumbing (your existing stuff) ----------
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

	function notifyProgress(payload) {
		chrome.runtime
			.sendMessage({ type: "RUN_PROGRESS", payload })
			.catch(() => {});
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

	// keep your find/set/fill fns as-is
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
			plan.dates?.length ?? 0,
			plan.hours?.length ?? 0,
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

		// ping ready once
		if (hasNyRad() && !readySent()) {
			setReadySent();
			chrome.runtime.sendMessage({ type: "PRIMULA_READY" }).catch(() => {});
		}

		const plan = loadPlan();
		if (!plan) return;
		if (isDone()) return;

		notifyProgress({ phase: "running", message: "Step 1/3…" });

		const targetClicks = Number(plan.targetClicks ?? 0);
		const delayMs = Number(plan.delayMs ?? 700);

		const count = getCount();
		console.log(
			`[MAU Helper] runId=${plan.runId} progress ${count}/${targetClicks}`,
		);

		notifyProgress({ phase: "running", message: "Step 2/3…" });

		if (count < targetClicks) {
			const btn = await waitForNyRad();
			if (!btn) return;

			await sleep(delayMs);
			setCount(count + 1);
			btn.click();
			return;
		}

		notifyProgress({ phase: "running", message: "Step 3/3…" });
		await sleep(700);
		await fillRows(plan);

		setDone();
		notifyProgress({ phase: "done", message: "Done ✅" });
	}

	chrome.runtime.onMessage.addListener((msg) => {
		if (msg?.type === "MAU_START") {
			const plan = msg.payload;

			sessionStorage.setItem(KEY_COUNT, "0");
			sessionStorage.removeItem(KEY_DONE);

			savePlan(plan);
			runAutomationIfPlanned();
		}
	});

	// ---------- bootstrap ----------
	injectUseButton();
	runAutomationIfPlanned();

	// keep working on dynamic pages
	const obs = new MutationObserver(() => {
		injectUseButton();
		runAutomationIfPlanned(); // also re-run readiness checks after DOM changes
	});
	obs.observe(document.documentElement, { childList: true, subtree: true });
}
