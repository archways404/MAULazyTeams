import { sleep } from "../../shared/time.js";
import { MSG } from "../../shared/constants.js";
import { loadJson, saveJson, ssGet, ssSet, ssDel, SKEY } from "../storage.js";
import { hasNyRad, findNyRadButtonLast, scrollIntoViewSafe } from "./dom.js";
import { waitForFormReady, waitForFormReadyCount, fillRows } from "./fill.js";

/** helpers for phase/lock */
function isLocked() {
  return ssGet(SKEY.LOCK) === "1";
}
function setLocked(v) {
  ssSet(SKEY.LOCK, v ? "1" : "0");
}

function getPhase() {
  return ssGet(SKEY.PHASE, "idle");
}
function setPhase(p) {
  ssSet(SKEY.PHASE, p);
}

function getClicksDone() {
  return Number(ssGet(SKEY.CLICKS_DONE, "0"));
}
function setClicksDone(n) {
  ssSet(SKEY.CLICKS_DONE, String(n));
}

function getTargetClicks() {
  return Number(ssGet(SKEY.TARGET_CLICKS, "0"));
}
function setTargetClicks(n) {
  ssSet(SKEY.TARGET_CLICKS, String(n));
}

function readySent() {
  return ssGet(SKEY.READY_SENT) === "1";
}
function setReadySent() {
  ssSet(SKEY.READY_SENT, "1");
}

function isDone() {
  return ssGet(SKEY.DONE) === "1";
}
function setDone() {
  ssSet(SKEY.DONE, "1");
}

function loadPlan() {
  return loadJson(SKEY.PLAN, null);
}
function savePlan(plan) {
  saveJson(SKEY.PLAN, plan);
}

function isPrimulaContext() {
  return (
    location.hostname.endsWith("mau.hr.evry.se") &&
    location.pathname.startsWith("/primula/")
  );
}

export function savePlanAndReset(plan) {
  ssDel(SKEY.DONE);
  ssDel(SKEY.STATUS_LOG);
  ssDel(SKEY.STATUS_LINE);

  ssDel(SKEY.PHASE);
  ssDel(SKEY.CLICKS_DONE);
  ssDel(SKEY.TARGET_CLICKS);

  savePlan(plan);

  const neededClicks = Number(
    plan.targetClicks ?? Math.max(0, (plan.dates?.length ?? 0) - 1),
  );
  setTargetClicks(neededClicks);
  setClicksDone(0);
  setPhase(neededClicks > 0 ? "adding" : "filling");
}

/**
 * runner depends on UI functions injected by modal.js
 * pass them in when booting:
 *  bootAutomationIfNeeded({ status, setUiMode, ensureModal, openModal, renderModal })
 */
export async function runAutomationIfPlanned(ui) {
  if (!isPrimulaContext()) return;
  if (isLocked()) return;

  setLocked(true);

  ui?.ensureModal?.();
  ui?.setUiMode?.("status");
  ui?.openModal?.();

  try {
    if (hasNyRad() && !readySent()) {
      setReadySent();
      chrome.runtime.sendMessage({ type: MSG.PRIMULA_READY }).catch(() => {});
    }

    const plan = loadPlan();
    if (!plan) {
      ui?.status?.("error", "No plan found");
      ui?.setUiMode?.("form");
      return;
    }

    if (isDone()) {
      ui?.status?.("done", "Already done");
      ui?.setUiMode?.("success");
      ui?.scheduleAutoCloseAfterSuccess?.();
      return;
    }

    ui?.status?.("running", "Waiting for form");
    const ready = await waitForFormReady();
    if (!ready) {
      ui?.status?.("error", "Form not ready on this page");
      ui?.setUiMode?.("error");
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

    // Phase: add rows
    if (getPhase() === "adding") {
      const target = getTargetClicks();
      const done = getClicksDone();

      if (done >= target) {
        setPhase("filling");
      } else {
        const btn = findNyRadButtonLast();
        if (!btn) {
          ui?.status?.("error", "Could not find Ny rad button");
          ui?.setUiMode?.("error");
          return;
        }

        ui?.status?.("running", `Adding rows (${done + 1}/${target})`);
        setClicksDone(done + 1);
        scrollIntoViewSafe(btn);
        btn.click();
        return; // page rerenders; runner will be re-entered
      }
    }

    // Phase: fill rows
    const total = Math.min(plan.dates?.length ?? 0, plan.hours?.length ?? 0);
    if (total <= 0) {
      ui?.status?.("error", "Plan is empty");
      ui?.setUiMode?.("error");
      return;
    }

    ui?.status?.("running", `Waiting for ${total} rows`);
    const okRows = await waitForFormReadyCount(total);
    if (!okRows) {
      ui?.status?.("error", `Not enough rows on page (need ${total})`);
      ui?.setUiMode?.("error");
      return;
    }

    ui?.status?.("running", "Filling and verifying");
    await sleep(150);

    const result = await fillRows(plan, { status: ui?.status });
    if (result.mismatches?.length) {
      ui?.status?.("error", "Not marking done due to mismatches");
      ui?.setUiMode?.("error");
      return;
    }

    setDone();
    ssDel(SKEY.PHASE);
    ssDel(SKEY.CLICKS_DONE);
    ssDel(SKEY.TARGET_CLICKS);

    ui?.status?.("done", "Done");
    ui?.setUiMode?.("success");
    ui?.scheduleAutoCloseAfterSuccess?.();
  } finally {
    setLocked(false);
    ui?.renderModal?.();
  }
}

/** called on startup / on refresh */
export function bootAutomationIfNeeded(ui) {
  if (!isPrimulaContext()) return;

  const plan = loadPlan();
  const phase = getPhase();
  const shouldResume = isLocked() || (plan && !isDone() && phase !== "idle");

  if (shouldResume) {
    ui?.ensureModal?.();
    ui?.setUiMode?.("status");
    ui?.openModal?.();
    runAutomationIfPlanned(ui);
  } else {
    ui?.setUiMode?.("form");
  }
}
