import {
  findDateInputs,
  findHoursInputs,
  findCompTypeSelects,
  setInputValue,
  setSelectValue,
} from "./dom.js";
import { sleep } from "../../shared/time.js";

function norm(v) {
  return String(v ?? "").trim();
}
function normHours(v) {
  return norm(v).replace(",", ".");
}

export async function waitForValue(el, expected, { timeoutMs = 1500 } = {}) {
  const start = Date.now();
  const exp = String(expected ?? "");
  while (Date.now() - start < timeoutMs) {
    if (String(el.value ?? "") === exp) return true;
    await sleep(25);
  }
  return false;
}

export async function waitForFormReady({ timeoutMs = 20000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (findDateInputs().length && findHoursInputs().length && findCompTypeSelects().length) {
      return true;
    }
    await sleep(150);
  }
  return false;
}

export async function waitForFormReadyCount(expectedRows, { timeoutMs = 20000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const d = findDateInputs().length;
    const h = findHoursInputs().length;
    const s = findCompTypeSelects().length;
    if (d >= expectedRows && h >= expectedRows && s >= expectedRows) return true;
    await sleep(150);
  }
  return false;
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
    comp: norm(plan.compTypeValues?.[i] ?? "MaUskrv1"),
  };
}

export async function verifyRow(plan, i, { retries = 3 } = {}) {
  const exp = expectedRow(plan, i);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const cur = getRowValues(i);
    if (!cur.dateEl || !cur.hourEl || !cur.compEl) {
      await sleep(150);
      continue;
    }

    const ok = cur.date === exp.date && cur.hours === exp.hours && cur.comp === exp.comp;
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

/**
 * fillRows(plan, { status }) – status(phase, message, extra?)
 */
export async function fillRows(plan, { status } = {}) {
  const total = Math.min(
    plan.dates?.length ?? 0,
    plan.hours?.length ?? 0,
    plan.compTypeValues?.length ?? 0,
  );
  status?.("running", `Filling rows (0/${total})`);

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
      console.warn("[MAULazyTeams] Row mismatch after retries", mismatches.at(-1));
    }

    status?.("running", `Filling rows (${i + 1}/${total})`);
    await sleep(25);
  }

  if (mismatches.length) status?.("error", `Filled with ${mismatches.length} mismatch(es)`);
  else status?.("running", `All rows verified (${total}/${total})`);

  return { mismatches };
}
