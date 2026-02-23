import { Temporal } from "@js-temporal/polyfill";
import { TZ } from "../shared/constants.js";

const SPLIT_HOUR = 19;

function isWeekend(zdt) {
  const day = zdt.dayOfWeek; // 1 = Monday, 7 = Sunday
  return day === 6 || day === 7;
}

function splitAtHour(startZdt, endZdt, hour) {
  const parts = [];
  let cursor = startZdt;

  while (cursor < endZdt) {
    const daySplit = cursor.with({
      hour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    // Next boundary is either the split time (if still ahead today) or end of this segment
    let nextBoundary;

    if (cursor < daySplit) {
      nextBoundary = Temporal.ZonedDateTime.compare(endZdt, daySplit) < 0 ? endZdt : daySplit;
      parts.push({ start: cursor, end: nextBoundary, part: "pre" });
    } else {
      // we're already after the split time, segment runs until endZdt or midnight
      const nextDay = cursor.add({ days: 1 }).with({ hour: 0, minute: 0, second: 0, millisecond: 0 });
      nextBoundary = Temporal.ZonedDateTime.compare(endZdt, nextDay) < 0 ? endZdt : nextDay;
      parts.push({ start: cursor, end: nextBoundary, part: "post" });
    }

    if (nextBoundary.equals(cursor)) break;

    cursor = nextBoundary;
  }

  return parts;
}

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

function categorize({ weekend, part, isSplit }) {
  const category = weekend
    ? part === "pre"
      ? "weekend"
      : "post19weekend"
    : part === "pre"
      ? "pre19"
      : "post19";

  const overallType = weekend
    ? isSplit
      ? "pre-post19weekend"
      : category // "weekend" or "post19weekend"
    : isSplit
      ? "pre-post19"
      : category; // "pre19" or "post19"

  return { category, overallType };
}

export function normalizeShift(shift) {
  const title = getShiftTitle(shift);
  const startZdt = toStockholmZdt(shift.sharedShift.startDateTime);
  const endZdt = toStockholmZdt(shift.sharedShift.endDateTime);

  const parts = splitAtHour(startZdt, endZdt, SPLIT_HOUR);

  const isSplit =
    parts.some(p => p.part === "pre") &&
    parts.some(p => p.part === "post");

  const sourceKey = `${shift?.id ?? ""}:${startZdt.toInstant().toString()}`;

  return parts.map(({ start, end, part }, index) => {
    const weekend = isWeekend(start);   // per segment
    const { category, overallType } =
      categorize({ weekend, part, isSplit });

    return {
      ShiftTitle: title,

      startDate: toDateString(start),
      startDateTime: toTimeString(start),
      endDate: toDateString(end),
      endDateTime: toTimeString(end),

      WorkedHours: workedHours(start, end),

      category,
      overallType,
      weekend,

      splitAtHour: SPLIT_HOUR,
      segment: part,
      segmentIndex: index,
      sourceKey,
    };
  });
}

export function normalizeShiftsPayload(payload) {
  const shifts = Array.isArray(payload?.shifts) ? payload.shifts : [];
  return shifts.flatMap(normalizeShift);
}

export function combineShiftsByDay(
  normalizedShifts,
  { summaryTitle = "Multiple shifts", mergeTitles = false } = {},
) {
  const byDate = new Map();

  for (const s of normalizedShifts) {
    const key = `${s.startDate}:${s.category}`;
    const arr = byDate.get(key) ?? [];
    arr.push(s);
    byDate.set(key, arr);
  }

  const combined = [];
  for (const [key, shifts] of byDate.entries()) {
  const [date, category] = key.split(":");

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
    category,                 // keep category
    mergedShifts: shifts,
  });
}

  combined.sort((a, b) =>
    a.startDate.localeCompare(b.startDate) ||
    a.category.localeCompare(b.category)
  );
  return combined;
}

export function filterByMonth(shifts, year, month) {
  return shifts.filter((shift) => {
    const date = Temporal.PlainDate.from(shift.startDate);
    return date.year === year && date.month === month;
  });
}
