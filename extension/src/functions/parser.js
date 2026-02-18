import { Temporal } from "@js-temporal/polyfill";
import { TZ } from "../shared/constants.js";

/** Safely pulls the "OR:TEK" etc. */
function getShiftTitle(shift) {
  return (
    shift?.sharedShift?.notes?.trim() ||
    shift?.sharedShift?.displayName?.trim() ||
    ""
  );
}

/** Graph ISO Z time (UTC) -> Stockholm local ZonedDateTime */
function toStockholmZdt(isoUtcString) {
  const inst = Temporal.Instant.from(isoUtcString);
  return inst.toZonedDateTimeISO(TZ);
}

function toDateString(zdt) {
  return zdt.toPlainDate().toString(); // "YYYY-MM-DD"
}

function toTimeString(zdt) {
  const t = zdt.toPlainTime();
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function workedHours(startZdt, endZdt) {
  const dur = startZdt.toInstant().until(endZdt.toInstant(), { largestUnit: "hours" });
  return Number(dur.total({ unit: "hours" }).toFixed(2));
}

export function normalizeShift(shift) {
  const title = getShiftTitle(shift);
  const startZdt = toStockholmZdt(shift.sharedShift.startDateTime);
  const endZdt = toStockholmZdt(shift.sharedShift.endDateTime);

  return {
    ShiftTitle: title,
    startDate: toDateString(startZdt),
    startDateTime: toTimeString(startZdt),
    endDate: toDateString(endZdt),
    endDateTime: toTimeString(endZdt),
    WorkedHours: workedHours(startZdt, endZdt),
  };
}

export function normalizeShiftsPayload(payload) {
  const shifts = Array.isArray(payload?.shifts) ? payload.shifts : [];
  return shifts.map(normalizeShift);
}

export function combineShiftsByDay(
  normalizedShifts,
  { summaryTitle = "Multiple shifts", mergeTitles = false } = {},
) {
  const byDate = new Map();

  for (const s of normalizedShifts) {
    const key = s.startDate;
    const arr = byDate.get(key) ?? [];
    arr.push(s);
    byDate.set(key, arr);
  }

  const combined = [];
  for (const [date, shifts] of byDate.entries()) {
    if (shifts.length === 1) {
      combined.push(shifts[0]);
      continue;
    }

    const totalHours = Number(
      shifts.reduce((sum, s) => sum + (Number(s.WorkedHours) || 0), 0).toFixed(2),
    );

    const title = mergeTitles
      ? [...new Set(shifts.map((s) => s.ShiftTitle).filter(Boolean))].join(" + ")
      : summaryTitle;

    combined.push({
      ShiftTitle: title,
      startDate: date,
      startDateTime: null,
      endDate: date,
      endDateTime: null,
      WorkedHours: totalHours,
      mergedShifts: shifts,
    });
  }

  combined.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return combined;
}

export function filterByMonth(shifts, year, month) {
  return shifts.filter((shift) => {
    const date = Temporal.PlainDate.from(shift.startDate);
    return date.year === year && date.month === month;
  });
}
