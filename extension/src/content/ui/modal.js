import { MAU_DOMAIN } from "../../shared/constants.js";
import { getStockholmYearMonthNow, normalizeUserToEmail } from "../../shared/time.js";
import { ensureStyles } from "./styles.js";
import { getSettings } from "../../shared/settings.js";
import {
  renderHeader,
  renderFormView,
  renderStatusView,
  renderSuccessView,
  renderErrorView,
} from "./templates.js";

import { startHealthPolling, stopHealthPolling, hookSettingsChanged } from "../healthPoll.js";
import { startFromPage, checkHealth, notifyProgress } from "../messaging.js";
import { appendLog, getLogLines, ssGet, ssSet, SKEY, LKEY } from "../storage.js";

let now = getStockholmYearMonthNow();

async function getHeaderFlags() {
  const s = await getSettings();
  return {
    apiKeySet: !!String(s.apiKey || "").trim(),
  };
}

function ensureOverlay() {
  if (document.getElementById("mauhelper-overlay")) return;

  const ov = document.createElement("div");
  ov.id = "mauhelper-overlay";
  ov.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.70);
    z-index: 999998;
    display: none;
    pointer-events: auto;
    backdrop-filter: blur(2px);
  `;

  ov.addEventListener("click", () => {
    const mode = getUiMode();
    if (mode === "status") return;
    if (mode === "success") return;
    if (!isLocked()) closeModal();
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
  ensureStyles();
  if (document.getElementById("mauhelper-modal")) return;

  const wrap = document.createElement("div");
  wrap.id = "mauhelper-modal";
  wrap.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 999999;
    width: 420px;
    max-width: calc(100vw - 32px);
    background: rgba(6,6,6,.98);
    color: #fff;
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 18px;
    padding: 16px;
    box-shadow: 0 22px 70px rgba(0,0,0,.70);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    display: none;
  `;
  document.body.appendChild(wrap);
  renderModal().catch(() => {});
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
  stopHealthPolling();
}

function removeModal() {
  document.getElementById("mauhelper-modal")?.remove();
  document.getElementById("mauhelper-overlay")?.remove();
}

function isLocked() {
  return ssGet(SKEY.LOCK) === "1";
}

function getUiMode() {
  return ssGet(SKEY.UI_MODE, "form");
}
function setUiMode(mode) {
  ssSet(SKEY.UI_MODE, mode);
  renderModal().catch(() => {});


  if (mode === "form") startHealthPolling(uiApi);
  else stopHealthPolling();
}

function getLastStatus() {
  return ssGet(SKEY.STATUS_LINE, "");
}
function setLastStatus(msg) {
  ssSet(SKEY.STATUS_LINE, String(msg ?? ""));
}

function isLogOpen() {
  return ssGet(SKEY.LOG_OPEN) === "1";
}
function setLogOpen(v) {
  ssSet(SKEY.LOG_OPEN, v ? "1" : "0");
  renderModal().catch(() => {});
}

function primeEmailField() {
  const m = document.getElementById("mauhelper-modal");
  if (!m) return;
  const userInput = m.querySelector("#mh-user");
  if (!userInput) return;

  const last = localStorage.getItem(LKEY.LAST_USER) || "";
  if (last && !userInput.value) userInput.value = last;
}

function updateStatusUI() {
  const m = document.getElementById("mauhelper-modal");
  if (!m) return;
  const el = m.querySelector("#mh-status");
  if (el) el.textContent = getLastStatus() || "";
}

function setStartEnabled(enabled, hint = "") {
  const m = document.getElementById("mauhelper-modal");
  if (!m) return;
  const btn = m.querySelector("#mh-start");
  if (!btn) return;

  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.45";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";

  if (hint) {
    setLastStatus(hint);
    updateStatusUI();
  }
}

function status(phase, message, extra = {}) {
  const msg = String(message ?? "");
  console.log(`[MAU Helper] ${msg}`, extra);

  setLastStatus(msg);
  appendLog(msg);

  notifyProgress({ phase, message: msg, ...extra });

  ensureModal();
  openModal();

  if (phase === "running") setUiMode("status");
  else if (phase === "error") setUiMode("error");
  else if (phase === "done") setUiMode("success");

  updateStatusUI();
}

function scheduleAutoCloseAfterSuccess() {
  setTimeout(() => {
    if (getUiMode() === "success" && !isLocked()) removeModal();
  }, 4000);
}

async function renderModal() {
  const m = document.getElementById("mauhelper-modal");
  if (!m) return;

  now = getStockholmYearMonthNow();

  const mode = getUiMode();
  const locked = isLocked();
  const lastStatus = getLastStatus();
  const logLines = getLogLines();
  const logOpen = isLogOpen();

  const { apiKeySet } = await getHeaderFlags();
  const header = renderHeader({ locked, apiKeySet });

  let body = "";
  if (mode === "status") body = renderStatusView({ lastStatus, logOpen, logLines });
  else if (mode === "success") body = renderSuccessView();
  else if (mode === "error") body = renderErrorView({ lastStatus });
  else body = renderFormView({ now, lastStatus });

  m.innerHTML = `${header}${body}`;

  // close
  m.querySelector("#mh-close")?.addEventListener("click", () => {
    if (isLocked()) return;
    closeModal();
  });

  // toggle log
  m.querySelector("#mh-log-toggle")?.addEventListener("click", () => {
    setLogOpen(!isLogOpen());
  });

  // form wiring
  if (mode === "form") {
    const userInput = m.querySelector("#mh-user");
    const yearInput = m.querySelector("#mh-year");
    const monthInput = m.querySelector("#mh-month");
    const startBtn = m.querySelector("#mh-start");

    primeEmailField();

    if (!apiKeySet) {
      setStartEnabled(false, "API key required. Set it in the extension popup.");
    }

    userInput?.addEventListener("blur", () => {
      const fixed = normalizeUserToEmail(userInput.value, MAU_DOMAIN);
      userInput.value = fixed.storeValue || fixed.displayValue || "";
      if (fixed.storeValue) localStorage.setItem(LKEY.LAST_USER, fixed.storeValue);
    });

    userInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        startBtn?.click();
      }
    });

    startBtn?.addEventListener("click", async () => {
      const h = await checkHealth();
      if (!h?.ok) {
        const msg = h?.message || h?.error || "Health check failed";
        setLastStatus(`Cannot start: ${msg} (${h?.baseUrl || "unknown"})`);
        appendLog(`Cannot start: ${msg} (${h?.baseUrl || "unknown"})`);
        updateStatusUI();
        return;
      }

      const rawUser = userInput?.value?.trim() || "";
      const fixed = normalizeUserToEmail(rawUser, MAU_DOMAIN);

      if (userInput) userInput.value = fixed.storeValue || rawUser;
      if (fixed.storeValue) localStorage.setItem(LKEY.LAST_USER, fixed.storeValue);

      const email = fixed.email || "";
      const year = Number(yearInput?.value);
      const month = Number(monthInput?.value);

      setLogOpen(false);
      setUiMode("status");
      openModal();

      setLastStatus("Fetching plan");
      appendLog("Fetching plan");
      updateStatusUI();

      startFromPage({ email, year, month }, (resp) => {
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
        setLastStatus("Started");
        appendLog("Started");
        updateStatusUI();
      });
    });
  }
}

/** public API used by runner/healthPoll */
export const uiApi = {
  ensureModal,
  openModal,
  closeModal,
  renderModal,
  status,
  setUiMode,
  scheduleAutoCloseAfterSuccess,
  setStartEnabled,
  isFormMode: () => getUiMode() === "form",
};

export function ensureModalSystem() {
  ensureModal();
  hookSettingsChanged(uiApi);
}

export function setupInjectButton() {
  if (document.getElementById("mauhelper-btn")) return;

  const konteringBtn = document.querySelector(
    'input[type="submit"].button.wide[value="Kontering"],' +
      'input[type="submit"][name="actionButtonText[11].valueString"][value="Kontering"],' +
      'input[type="submit"][title="Kontering"][value="Kontering"]'
  );
  if (!konteringBtn) return;

  const innerTd = konteringBtn.closest("td");
  if (!innerTd) return;

  const outerTd = innerTd.closest('td[colspan="4"]') || innerTd;
  if (getComputedStyle(outerTd).position === "static") {
    outerTd.style.position = "relative";
  }

  const btn = document.createElement("button");
  btn.id = "mauhelper-btn";
  btn.type = "button";
  btn.title = "Open PrimAssist";
  btn.setAttribute("aria-label", "Open PrimAssist");
  btn.style.cssText = `
    position:absolute;
    right:6px;
    top:70%;
    transform:translateY(-50%) scale(1);
    width:64px;
    height:64px;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    border: none;
    background:transparent;
    padding:0;
    z-index:5;
    transition: transform .12s ease;
  `;

  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("icons/icon512.png");
  img.alt = "PrimAssist";
  img.style.cssText = `
    width:56px;
    height:56px;
    display:block;
    pointer-events:none;
    user-select:none;
  `;
  btn.appendChild(img);

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "translateY(-50%) scale(1.08)";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "translateY(-50%) scale(1)";
  });

  btn.addEventListener("click", () => {
    uiApi.ensureModal();
    uiApi.setUiMode("form");
    uiApi.openModal();
    primeEmailField();
  });

  outerTd.appendChild(btn);
  console.log("[PrimAssist] Injected icon button");
}




