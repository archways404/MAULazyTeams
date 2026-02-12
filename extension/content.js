// content.js
if (window.top !== window) {
	// skip iframes
} else {
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	const KEY_PLAN = "__MAU_PLAN__";
	const KEY_DONE = "__MAU_FORM_DONE__";
	const KEY_READY_SENT = "__MAU_READY_SENT__";

	// ✅ state across refreshes
	const KEY_PHASE = "__MAU_PHASE__"; // "idle" | "adding" | "filling"
	const KEY_CLICKS_DONE = "__MAU_CLICKS_DONE__";
	const KEY_TARGET_CLICKS = "__MAU_TARGET_CLICKS__";

	// ✅ re-entry lock (prevents concurrent runs)
	const KEY_LOCK = "__MAU_LOCK__";

	// ✅ UI mode across refreshes
	const KEY_UI_MODE = "__MAU_UI_MODE__"; // "form" | "status" | "success" | "error"
	const KEY_STATUS_LINE = "__MAU_STATUS_LINE__"; // last status message
	const KEY_STATUS_LOG = "__MAU_STATUS_LOG__"; // optional log (stringified array)

	// ✅ persist last user email/username
	const KEY_LAST_USER = "mauhelper:lastUser"; // localStorage
	const MAU_DOMAIN = "@mau.se";

	// --- helpers ---
	function isLocked() {
		return sessionStorage.getItem(KEY_LOCK) === "1";
	}
	function setLocked(v) {
		sessionStorage.setItem(KEY_LOCK, v ? "1" : "0");
	}

	function getPhase() {
		return sessionStorage.getItem(KEY_PHASE) || "idle";
	}
	function setPhase(p) {
		sessionStorage.setItem(KEY_PHASE, p);
	}

	function getClicksDone() {
		return Number(sessionStorage.getItem(KEY_CLICKS_DONE) || "0");
	}
	function setClicksDone(n) {
		sessionStorage.setItem(KEY_CLICKS_DONE, String(n));
	}

	function getTargetClicks() {
		return Number(sessionStorage.getItem(KEY_TARGET_CLICKS) || "0");
	}
	function setTargetClicks(n) {
		sessionStorage.setItem(KEY_TARGET_CLICKS, String(n));
	}

	function readySent() {
		return sessionStorage.getItem(KEY_READY_SENT) === "1";
	}
	function setReadySent() {
		sessionStorage.setItem(KEY_READY_SENT, "1");
	}

	function isDone() {
		return sessionStorage.getItem(KEY_DONE) === "1";
	}
	function setDone() {
		sessionStorage.setItem(KEY_DONE, "1");
	}

	function getUiMode() {
		return sessionStorage.getItem(KEY_UI_MODE) || "form";
	}
	function setUiMode(mode) {
		sessionStorage.setItem(KEY_UI_MODE, mode);
		renderModal();
	}

	function getLastStatus() {
		return sessionStorage.getItem(KEY_STATUS_LINE) || "";
	}
	function setLastStatus(msg) {
		sessionStorage.setItem(KEY_STATUS_LINE, String(msg ?? ""));
	}

	function appendLog(line) {
		try {
			const raw = sessionStorage.getItem(KEY_STATUS_LOG);
			const arr = raw ? JSON.parse(raw) : [];
			arr.push({ t: Date.now(), line: String(line ?? "") });
			// keep last 40 lines
			const trimmed = arr.slice(-40);
			sessionStorage.setItem(KEY_STATUS_LOG, JSON.stringify(trimmed));
		} catch {
			// ignore
		}
	}

	function getLogLines() {
		try {
			const raw = sessionStorage.getItem(KEY_STATUS_LOG);
			const arr = raw ? JSON.parse(raw) : [];
			return arr.map((x) => x.line);
		} catch {
			return [];
		}
	}

	function clearRunState() {
		sessionStorage.removeItem(KEY_PHASE);
		sessionStorage.removeItem(KEY_CLICKS_DONE);
		sessionStorage.removeItem(KEY_TARGET_CLICKS);
		sessionStorage.removeItem(KEY_LOCK);
		sessionStorage.removeItem(KEY_UI_MODE);
		sessionStorage.removeItem(KEY_STATUS_LINE);
		sessionStorage.removeItem(KEY_STATUS_LOG);
	}

	function notifyProgress(payload) {
		chrome.runtime
			.sendMessage({ type: "RUN_PROGRESS", payload })
			.catch(() => {});
	}

	function status(phase, message, extra = {}) {
		const msg = String(message ?? "");
		const line = `[MAU Helper] ${msg}`;
		console.log(line, extra);

		setLastStatus(msg);
		appendLog(msg);

		notifyProgress({ phase, message: msg, ...extra });

		// keep modal open while running/status mode
		ensureModal();
		openModal();
		if (isLocked()) setUiMode("status");

		// update the visible UI immediately
		updateStatusUI();
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
      font-weight: 800;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(15,15,15,.9);
      color: #fff;
    `;

		btn.addEventListener("click", () => {
			ensureModal();
			setUiMode(isLocked() ? "status" : "form");
			openModal();
			primeEmailField();
			renderModal();
		});

		sel.insertAdjacentElement("afterend", btn);
		console.log("[MAU Helper] Injected USE MAUHELPER button");
	}

	// ---------- modal UI ----------
	function getStockholmYearMonthNow() {
		const parts = new Intl.DateTimeFormat("sv-SE", {
			timeZone: "Europe/Stockholm",
			year: "numeric",
			month: "2-digit",
		}).formatToParts(new Date());

		const year = Number(parts.find((p) => p.type === "year")?.value);
		const month = Number(parts.find((p) => p.type === "month")?.value);
		return { year, month };
	}

	const now = getStockholmYearMonthNow();

	function ensureOverlay() {
		if (document.getElementById("mauhelper-overlay")) return;

		const ov = document.createElement("div");
		ov.id = "mauhelper-overlay";
		ov.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55); /* ✅ darker */
      z-index: 999998;
      display: none;
      pointer-events: auto; /* blocks click-through */
      backdrop-filter: blur(1px);
    `;

		ov.addEventListener("click", () => {
			// allow closing only when not running
			if (!isLocked()) closeAndMaybeRemoveModal();
		});

		document.body.appendChild(ov);
	}

	function openOverlay() {
		const ov = document.getElementById("mauhelper-overlay");
		if (ov) ov.style.display = "block";
	}
	function closeOverlay() {
		const ov = document.getElementById("mauhelper-overlay");
		if (ov) ov.style.display = "none";
	}

	function ensureModal() {
		ensureOverlay();
		if (document.getElementById("mauhelper-modal")) return;

		const wrap = document.createElement("div");
		wrap.id = "mauhelper-modal";
		wrap.style.cssText = `
      position: fixed;
      top: 50%;
      left: 75%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      width: 380px;
      background: rgba(10,10,10,.96);
      color: #fff;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      padding: 14px;
      box-shadow: 0 18px 50px rgba(0,0,0,.60);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      display: none;
    `;

		document.body.appendChild(wrap);
		renderModal();
	}

	function openModal() {
		const m = document.getElementById("mauhelper-modal");
		if (m) m.style.display = "block";
		openOverlay();
	}

	function closeModal() {
		const m = document.getElementById("mauhelper-modal");
		if (m) m.style.display = "none";
		closeOverlay();
	}

	function removeModal() {
		const m = document.getElementById("mauhelper-modal");
		const ov = document.getElementById("mauhelper-overlay");
		if (m) m.remove();
		if (ov) ov.remove();
	}

	function closeAndMaybeRemoveModal() {
		// If you prefer fully removing every time:
		// removeModal();
		// Otherwise just close:
		closeModal();
	}

	function primeEmailField() {
		const m = document.getElementById("mauhelper-modal");
		if (!m) return;
		const userInput = m.querySelector("#mh-user");
		if (!userInput) return;

		const last = localStorage.getItem(KEY_LAST_USER) || "";
		if (last && !userInput.value) userInput.value = last;
	}

	function normalizeUserToEmail(input) {
		const raw = String(input ?? "").trim();
		if (!raw) return { email: "", displayValue: "", storeValue: "" };

		if (raw.includes("@")) {
			const email = raw;
			return { email, displayValue: email, storeValue: email };
		}

		const email = `${raw}${MAU_DOMAIN}`;
		return { email, displayValue: email, storeValue: raw };
	}

	function esc(s) {
		return String(s ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#039;");
	}

	function renderModal() {
		const m = document.getElementById("mauhelper-modal");
		if (!m) return;

		const mode = getUiMode();
		const locked = isLocked();
		const last = getLastStatus();
		const logLines = getLogLines();
		const logText =
			logLines.length > 0 ? logLines.map((l) => `• ${l}`).join("\n") : "";

		// shared styles
		const cssBtn = `
      width: 100%;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.08);
      color: #fff;
      cursor: pointer;
      font-weight: 900;
      letter-spacing: .2px;
    `;
		const cssBtnPrimary = `
      ${cssBtn}
      background: rgba(90,120,255,.22);
      border: 1px solid rgba(90,120,255,.35);
    `;
		const cssInput = `
      width:100%;
      padding:10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color:#fff;
      outline: none;
    `;

		const header = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:10px;height:10px;border-radius:999px;background:${locked ? "rgba(255,190,60,.95)" : "rgba(120,255,160,.85)"};box-shadow:0 0 18px ${locked ? "rgba(255,190,60,.25)" : "rgba(120,255,160,.20)"};"></div>
          <div>
            <div style="font-weight:950;font-size:14px;line-height:1;">MAU Helper</div>
            <div style="font-size:11px;opacity:.75;margin-top:4px;">
              ${locked ? "Running…" : "Ready"}
            </div>
          </div>
        </div>

        <button id="mh-close" title="Close"
          style="background:transparent;border:none;color:#fff;font-size:18px;cursor:${locked ? "not-allowed" : "pointer"};opacity:${locked ? ".35" : ".9"};padding:4px 8px;">
          ✕
        </button>
      </div>
    `;

		const formView = `
      <div id="mh-form" style="margin-top:12px;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <div style="font-size:12px;opacity:.85;margin-bottom:6px;">MAU ID / Email</div>
            <input id="mh-user" placeholder="ab1234 or ab1234@mau.se" style="${cssInput}" />
            <div style="margin-top:6px;font-size:11px;opacity:.65;">
              Tip: type <b>ab1234</b> and we’ll append <b>@mau.se</b>.
            </div>
          </div>

          <div style="display:flex;gap:10px;">
            <div style="flex:1;">
              <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Year</div>
              <input id="mh-year" type="number" min="2000" max="2100" value="${now.year}" style="${cssInput}" />
            </div>
            <div style="flex:1;">
              <div style="font-size:12px;opacity:.85;margin-bottom:6px;">Month</div>
              <input id="mh-month" type="number" min="1" max="12" value="${now.month}" style="${cssInput}" />
            </div>
          </div>

          <button id="mh-start" style="${cssBtnPrimary}">
            Fetch + Start
          </button>

          <div id="mh-status" style="font-size:12px;opacity:.9;white-space:pre-wrap;min-height:20px;">
            ${esc(last || "")}
          </div>
        </div>
      </div>
    `;

		const statusView = `
      <div id="mh-status-only" style="margin-top:12px;">
        <div style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);">
          <div style="font-size:12px;opacity:.75;">Status</div>
          <div id="mh-status" style="margin-top:6px;font-size:13px;font-weight:800;white-space:pre-wrap;">
            ${esc(last || "Working…")}
          </div>
        </div>

        <div style="margin-top:10px;font-size:11px;opacity:.7;white-space:pre-wrap;max-height:160px;overflow:auto;border-radius:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.15);">
${esc(logText || "• Waiting for updates…")}
        </div>

        <div style="margin-top:10px;font-size:11px;opacity:.65;">
          Keep this open — Primula refreshes while adding rows.
        </div>
      </div>
    `;

		const successView = `
      <div id="mh-success" style="margin-top:14px;">
        <div style="padding:14px 14px;border-radius:16px;border:1px solid rgba(120,255,160,.25);background:rgba(120,255,160,.10);">
          <div style="font-size:12px;opacity:.8;">Success</div>
          <div style="margin-top:6px;font-size:15px;font-weight:950;">Done ✅</div>
          <div style="margin-top:6px;font-size:12px;opacity:.8;">Closing in a moment…</div>
        </div>
      </div>
    `;

		const errorView = `
      <div id="mh-error" style="margin-top:14px;">
        <div style="padding:14px 14px;border-radius:16px;border:1px solid rgba(255,100,100,.22);background:rgba(255,100,100,.10);">
          <div style="font-size:12px;opacity:.8;">Error</div>
          <div id="mh-status" style="margin-top:6px;font-size:13px;font-weight:900;white-space:pre-wrap;">${esc(last || "Something went wrong.")}</div>
          <div style="margin-top:8px;font-size:11px;opacity:.75;">You can close this and retry.</div>
        </div>
      </div>
    `;

		let body = "";
		if (mode === "status") body = statusView;
		else if (mode === "success") body = successView;
		else if (mode === "error") body = errorView;
		else body = formView;

		m.innerHTML = `${header}${body}`;

		// wire close
		m.querySelector("#mh-close")?.addEventListener("click", () => {
			if (isLocked()) return;
			closeAndMaybeRemoveModal();
		});

		// wire form only when in form mode
		if (mode === "form") {
			const userInput = m.querySelector("#mh-user");
			const yearInput = m.querySelector("#mh-year");
			const monthInput = m.querySelector("#mh-month");
			const startBtn = m.querySelector("#mh-start");
			const statusEl = m.querySelector("#mh-status");

			primeEmailField();

			userInput?.addEventListener("blur", () => {
				const fixed = normalizeUserToEmail(userInput.value);
				userInput.value = fixed.displayValue;
				if (fixed.storeValue)
					localStorage.setItem(KEY_LAST_USER, fixed.storeValue);
			});

			userInput?.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					startBtn?.click();
				}
			});

			startBtn?.addEventListener("click", async () => {
				const rawUser = userInput?.value?.trim() || "";
				const fixed = normalizeUserToEmail(rawUser);
				if (userInput) userInput.value = fixed.displayValue;
				if (fixed.storeValue)
					localStorage.setItem(KEY_LAST_USER, fixed.storeValue);

				const email = fixed.email || "";
				const year = Number(yearInput?.value);
				const month = Number(monthInput?.value);

				// switch UI immediately
				setUiMode("status");
				openModal();
				setLastStatus("Fetching plan…");
				appendLog("Fetching plan…");
				updateStatusUI();

				chrome.runtime.sendMessage(
					{ type: "START_FROM_PAGE", payload: { email, year, month } },
					(resp) => {
						const err = chrome.runtime.lastError;
						if (err) {
							setLastStatus(`Error: ${err.message}`);
							appendLog(`Error: ${err.message}`);
							setUiMode("error");
							return;
						}
						if (!resp?.ok) {
							setLastStatus(`Error: ${resp?.error || "Unknown"}`);
							appendLog(`Error: ${resp?.error || "Unknown"}`);
							setUiMode("error");
							return;
						}
						setLastStatus("Started ✅");
						appendLog("Started ✅");
						updateStatusUI();
					},
				);
			});

			if (statusEl) statusEl.textContent = getLastStatus() || "";
		}
	}

	function updateStatusUI() {
		const m = document.getElementById("mauhelper-modal");
		if (!m) return;
		const el = m.querySelector("#mh-status");
		if (el) el.textContent = getLastStatus() || "";
		// refresh log view if we are in status mode
		if (getUiMode() === "status") renderModal();
	}

	// ---------- plan storage ----------
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

	// ---------- selectors ----------
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

	function findAllNyRadButtons() {
		return Array.from(
			document.querySelectorAll(
				'input[type="submit"][value="Ny rad"].button.wide',
			),
		);
	}
	function findNyRadButtonLast() {
		const all = findAllNyRadButtons();
		return all.length ? all[all.length - 1] : null;
	}

	// ---------- setters ----------
	function scrollIntoViewSafe(el) {
		try {
			el?.scrollIntoView?.({ block: "center", inline: "nearest" });
		} catch {}
	}

	function setInputValue(el, value) {
		scrollIntoViewSafe(el);
		el.focus();
		el.value = value;
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
		el.blur();
	}

	function setSelectValue(el, value) {
		scrollIntoViewSafe(el);
		el.focus();
		el.value = value;
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
		el.blur();
	}

	async function waitForValue(el, expected, { timeoutMs = 1500 } = {}) {
		const start = Date.now();
		const exp = String(expected ?? "");
		while (Date.now() - start < timeoutMs) {
			if (String(el.value ?? "") === exp) return true;
			await sleep(25);
		}
		return false;
	}

	async function waitForFormReady({ timeoutMs = 20000 } = {}) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			if (
				findDateInputs().length &&
				findHoursInputs().length &&
				findCompTypeSelects().length
			) {
				return true;
			}
			await sleep(150);
		}
		return false;
	}

	async function waitForFormReadyCount(
		expectedRows,
		{ timeoutMs = 20000 } = {},
	) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const d = findDateInputs().length;
			const h = findHoursInputs().length;
			const s = findCompTypeSelects().length;
			if (d >= expectedRows && h >= expectedRows && s >= expectedRows)
				return true;
			await sleep(150);
		}
		return false;
	}

	// ---------- verification helpers ----------
	function norm(v) {
		return String(v ?? "").trim();
	}
	function normHours(v) {
		return norm(v).replace(",", ".");
	}

	function getRowValues(i) {
		const dateEl = findDateInputs()[i];
		const hourEl = findHoursInputs()[i];
		const compEl = findCompTypeSelects()[i];
		return {
			dateEl,
			hourEl,
			compEl,
			date: norm(dateEl?.value),
			hours: normHours(hourEl?.value),
			comp: norm(compEl?.value),
		};
	}

	function expectedRow(plan, i) {
		return {
			date: norm(plan.dates?.[i]),
			hours: normHours(plan.hours?.[i]),
			comp: norm(plan.compTypeValue ?? "0214"),
		};
	}

	async function verifyRow(plan, i, { retries = 3 } = {}) {
		const exp = expectedRow(plan, i);

		for (let attempt = 1; attempt <= retries; attempt++) {
			const cur = getRowValues(i);

			if (!cur.dateEl || !cur.hourEl || !cur.compEl) {
				await sleep(150);
				continue;
			}

			const ok =
				cur.date === exp.date &&
				cur.hours === exp.hours &&
				cur.comp === exp.comp;
			if (ok) return { ok: true, attempt };

			setInputValue(cur.dateEl, exp.date);
			await waitForValue(cur.dateEl, exp.date);

			setInputValue(cur.hourEl, exp.hours);
			await waitForValue(cur.hourEl, exp.hours);

			setSelectValue(cur.compEl, exp.comp);
			await sleep(100);
		}

		const final = getRowValues(i);
		return { ok: false, expected: exp, got: final };
	}

	// ---------- main automation (refresh-aware) ----------
	async function fillRows(plan) {
		const total = Math.min(plan.dates?.length ?? 0, plan.hours?.length ?? 0);
		status("running", `Filling rows… (0/${total})`);

		const mismatches = [];

		for (let i = 0; i < total; i++) {
			const exp = expectedRow(plan, i);

			const dateEl = findDateInputs()[i];
			const hourEl = findHoursInputs()[i];
			const compEl = findCompTypeSelects()[i];

			if (!dateEl || !hourEl || !compEl) {
				await sleep(200);
				i--;
				continue;
			}

			setInputValue(dateEl, exp.date);
			await waitForValue(dateEl, exp.date);

			setInputValue(hourEl, exp.hours);
			await waitForValue(hourEl, exp.hours);

			setSelectValue(compEl, exp.comp);

			const ver = await verifyRow(plan, i, { retries: 3 });
			if (!ver.ok) {
				mismatches.push({
					row: i,
					expected: ver.expected,
					got: {
						date: ver.got?.date,
						hours: ver.got?.hours,
						comp: ver.got?.comp,
					},
				});
				console.warn(
					"[MAU Helper] Row mismatch after retries",
					mismatches[mismatches.length - 1],
				);
			}

			status("running", `Filling rows… (${i + 1}/${total})`);
			await sleep(25);
		}

		if (mismatches.length) {
			status("error", `Filled with ${mismatches.length} mismatch(es).`);
		} else {
			status("running", `All rows verified ✅ (${total}/${total})`);
		}

		return { mismatches };
	}

	function scheduleAutoCloseAfterSuccess() {
		// show success for 4s then remove modal+overlay
		setTimeout(() => {
			// only auto-close if still success and not locked
			if (getUiMode() === "success" && !isLocked()) {
				removeModal();
			}
		}, 4000);
	}

	async function runAutomationIfPlanned() {
		if (
			!location.hostname.endsWith("mau.hr.evry.se") ||
			!location.pathname.startsWith("/primula/")
		)
			return;

		if (isLocked()) return;

		setLocked(true);
		ensureModal();
		setUiMode("status");
		openModal();

		try {
			if (hasNyRad() && !readySent()) {
				setReadySent();
				chrome.runtime.sendMessage({ type: "PRIMULA_READY" }).catch(() => {});
			}

			const plan = loadPlan();
			if (!plan) {
				status("idle", "No plan found.");
				setUiMode("form");
				return;
			}
			if (isDone()) {
				status("done", "Already done ✅");
				setUiMode("success");
				scheduleAutoCloseAfterSuccess();
				return;
			}

			status("running", "Waiting for form…");
			const ready = await waitForFormReady();
			if (!ready) {
				status("error", "Form not ready on this page.");
				setUiMode("error");
				return;
			}

			if (getPhase() === "idle") {
				const neededClicks = Number(
					plan.targetClicks ?? Math.max(0, (plan.dates?.length ?? 0) - 1),
				);
				setTargetClicks(neededClicks);
				setClicksDone(0);
				setPhase(neededClicks > 0 ? "adding" : "filling");
			}

			const phase2 = getPhase();
			const target2 = getTargetClicks();
			const done2 = getClicksDone();

			if (phase2 === "adding") {
				if (done2 >= target2) {
					setPhase("filling");
				} else {
					const btn = findNyRadButtonLast();
					if (!btn) {
						status("error", "Could not find Ny rad button.");
						setUiMode("error");
						return;
					}

					status("running", `Adding rows… (${done2 + 1}/${target2})`);

					// increment BEFORE click (refresh likely)
					setClicksDone(done2 + 1);

					scrollIntoViewSafe(btn);
					btn.click();
					return; // next load continues
				}
			}

			const total = Math.min(plan.dates?.length ?? 0, plan.hours?.length ?? 0);
			if (total <= 0) {
				status("error", "Plan is empty (no rows to fill).");
				setUiMode("error");
				return;
			}

			status("running", `Waiting for ${total} rows…`);
			const okRows = await waitForFormReadyCount(total);
			if (!okRows) {
				status("error", `Not enough rows on page (need ${total}).`);
				setUiMode("error");
				return;
			}

			status("running", "Filling + verifying…");
			await sleep(150);

			const result = await fillRows(plan);
			if (result.mismatches?.length) {
				status("error", "Not marking done due to mismatches.");
				setUiMode("error");
				return;
			}

			setDone();
			// keep plan in storage, but clear run mechanics + UI state
			sessionStorage.removeItem(KEY_PHASE);
			sessionStorage.removeItem(KEY_CLICKS_DONE);
			sessionStorage.removeItem(KEY_TARGET_CLICKS);

			status("done", "Done ✅");
			setUiMode("success");
			scheduleAutoCloseAfterSuccess();
		} finally {
			setLocked(false);
			// allow close again (success auto-closes anyway)
			renderModal();
		}
	}

	chrome.runtime.onMessage.addListener((msg) => {
		if (msg?.type === "MAU_START") {
			const plan = msg.payload;

			// reset run-specific state but keep UI
			sessionStorage.removeItem(KEY_DONE);
			sessionStorage.removeItem(KEY_STATUS_LOG);
			sessionStorage.removeItem(KEY_STATUS_LINE);

			// don't clear lock here; runAutomation controls it
			sessionStorage.removeItem(KEY_PHASE);
			sessionStorage.removeItem(KEY_CLICKS_DONE);
			sessionStorage.removeItem(KEY_TARGET_CLICKS);

			savePlan(plan);

			const neededClicks = Number(
				plan.targetClicks ?? Math.max(0, (plan.dates?.length ?? 0) - 1),
			);
			setTargetClicks(neededClicks);
			setClicksDone(0);
			setPhase(neededClicks > 0 ? "adding" : "filling");

			ensureModal();
			setUiMode("status");
			openModal();

			setLastStatus("Plan received. Starting…");
			appendLog("Plan received. Starting…");
			updateStatusUI();

			runAutomationIfPlanned();
		}
	});

	// ---------- bootstrap ----------
	injectUseButton();
	ensureModal();

	// If we're mid-run across refresh, auto-open modal + continue in status mode
	if (isLocked() || (loadPlan() && !isDone() && getPhase() !== "idle")) {
		setUiMode("status");
		openModal();
		runAutomationIfPlanned();
	} else {
		// default to form view when user opens it
		setUiMode("form");
	}

	// Only keep UI injection reactive (avoid rerun spam)
	const obs = new MutationObserver(() => {
		injectUseButton();
	});
	obs.observe(document.documentElement, { childList: true, subtree: true });
}
