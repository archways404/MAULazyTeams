import { Temporal } from "@js-temporal/polyfill";

const TZ = "Europe/Stockholm";

/**
 * Safely pulls the "OR:TEK" etc.
 */
function getShiftTitle(shift) {
	return (
		shift?.sharedShift?.notes?.trim() ||
		shift?.sharedShift?.displayName?.trim() ||
		""
	);
}

/**
 * Converts a Graph ISO Z time (UTC) -> Stockholm local ZonedDateTime
 */
function toStockholmZdt(isoUtcString) {
	// input like "2026-01-26T07:30:00Z"
	const inst = Temporal.Instant.from(isoUtcString);
	return inst.toZonedDateTimeISO(TZ);
}

/**
 * Formats helpers
 */
function toDateString(zdt) {
	// "2026-01-26"
	return zdt.toPlainDate().toString();
}

function toTimeString(zdt) {
	// "09:00" (no seconds)
	const t = zdt.toPlainTime();
	return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function workedHours(startZdt, endZdt) {
	// robust across DST changes: compute in instants
	const dur = startZdt
		.toInstant()
		.until(endZdt.toInstant(), { largestUnit: "hours" });
	// e.g. PT4H30M -> 4.5
	return Number(dur.total({ unit: "hours" }).toFixed(2));
}

/**
 * Main transformation: Graph shift -> your format
 */
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

/**
 * Whole payload -> normalized list
 */
export function normalizeShiftsPayload(payload) {
	const shifts = Array.isArray(payload?.shifts) ? payload.shifts : [];
	return shifts.map(normalizeShift);
}

/**
 * normalized item shape:
 * {
 *   ShiftTitle, startDate, startDateTime, endDate, endDateTime, WorkedHours
 * }
 */

/**
 * Combine shifts per day:
 * - If a day has 1 shift: keep it as-is
 * - If a day has 2+ shifts: replace with one summary row:
 *   - startDate/endDate kept
 *   - startDateTime/endDateTime set to null
 *   - WorkedHours summed
 *   - ShiftTitle can be a fixed label OR merged titles
 */
export function combineShiftsByDay(
	normalizedShifts,
	{
		summaryTitle = "Multiple shifts",
		mergeTitles = false, // if true, join titles like "OR:TEK + OR:ADM"
	} = {},
) {
	const byDate = new Map();

	for (const s of normalizedShifts) {
		const key = s.startDate; // assumes same-day shift; otherwise use a different strategy
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
			shifts
				.reduce((sum, s) => sum + (Number(s.WorkedHours) || 0), 0)
				.toFixed(2),
		);

		const title = mergeTitles
			? [...new Set(shifts.map((s) => s.ShiftTitle).filter(Boolean))].join(
					" + ",
				)
			: summaryTitle;

		combined.push({
			ShiftTitle: title,
			startDate: date,
			startDateTime: null,
			endDate: date,
			endDateTime: null,
			WorkedHours: totalHours,

			// optional: keep what was merged for debugging / UI drilldown
			mergedShifts: shifts,
		});
	}

	// sort by date ascending
	combined.sort((a, b) => a.startDate.localeCompare(b.startDate));

	return combined;
}

/**
 * Filters normalized shifts to a specific month + year
 *
 * @param {Array} shifts - normalized shifts
 * @param {number} year  - e.g. 2026
 * @param {number} month - 1-12
 */
export function filterByMonth(shifts, year, month) {
	return shifts.filter((shift) => {
		const date = Temporal.PlainDate.from(shift.startDate);
		return date.year === year && date.month === month;
	});
}
