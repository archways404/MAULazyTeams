function toPrimulaDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${y}${m}${d}`;
}

export function makePrimulaPlanFromShifts(shifts) {
  const sorted = [...shifts].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const dates = sorted.map((s) => toPrimulaDate(s.startDate));
  const hours = sorted.map((s) => String(s.WorkedHours ?? ""));
  const targetClicks = Math.max(0, dates.length - 1);

  return {
    runId: String(Date.now()),
    dates,
    hours,
    compTypeValue: "0214",
    delayMs: 700,
    fillDelayMs: 250,
    targetClicks,
    debug: { mergedFiltered: sorted },
  };
}
