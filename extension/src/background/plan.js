// plan.js

function toPrimulaDate(isoDate) {
  const [y, m, d] = String(isoDate ?? "").split("-");
  return `${y}${m}${d}`; // YYYYMMDD
}

function toPrimulaHours(value) {
  // Always "0.00" style with dot
  const n = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export function makePrimulaPlanFromShifts(shifts) {
  const sorted = [...(shifts ?? [])].sort((a, b) =>
    String(a.startDate).localeCompare(String(b.startDate)) ||
    String(a.category ?? "").localeCompare(String(b.category ?? "")),
  );

  const dates = sorted.map((s) => toPrimulaDate(s.startDate));
  const hours = sorted.map((s) => toPrimulaHours(s.WorkedHours));

  // IMPORTANT: fill.js expects this array (same length as dates/hours)
  const compTypeValues = sorted.map((s) => {
    const v = String(s.compTypeValue ?? "").trim();
    // If you prefer hard fail instead of silent fallback, throw here.
    return v || "MaUskrv1";
  });

  const targetClicks = Math.max(0, dates.length - 1);

  return {
    runId: String(Date.now()),
    dates,
    hours,
    compTypeValues,
    delayMs: 700,
    fillDelayMs: 250,
    targetClicks,
    debug: { mergedFiltered: sorted },
  };
}