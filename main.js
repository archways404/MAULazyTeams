import { Temporal } from "@js-temporal/polyfill";
import dotenv from "dotenv";
import { graphRequestSchedule, graphRequestUserID } from "./functions/fetch.js";
import { parseDebugOptions } from "./functions/helpers.js";
import { createLogger } from "./functions/log.js";
// internal logic
import { fetchJWT } from "./functions/puppeteer.js";

function filterPersonalShifts(data, userId) {
	const shifts = Array.isArray(data?.value) ? data.value : [];

	return shifts.filter((shift) => {
		if (!shift) return false;
		if (shift.userId !== userId) return false;
		if (shift.isStagedForDeletion) return false;
		return true;
	});
}

// helper
const TZ = "Europe/Stockholm";

function formatPersonalShiftTemporal(shift) {
	const s = shift.sharedShift ?? shift.draftShift;
	if (!s?.startDateTime || !s?.endDateTime) return null;

	// Parse the UTC timestamps as Instants
	const startInstant = Temporal.Instant.from(s.startDateTime);
	const endInstant = Temporal.Instant.from(s.endDateTime);

	// Convert to Stockholm time
	const startZoned = startInstant.toZonedDateTimeISO(TZ);
	const endZoned = endInstant.toZonedDateTimeISO(TZ);

	const date = startZoned.toPlainDate().toString(); // "2026-02-24"

	const startTime = startZoned
		.toPlainTime()
		.toString({ smallestUnit: "minute" });
	const endTime = endZoned.toPlainTime().toString({ smallestUnit: "minute" });

	// Duration math
	const duration = endInstant.since(startInstant).round({
		largestUnit: "hours",
		smallestUnit: "minutes",
	});

	const hours = duration.hours;
	const minutes = duration.minutes;

	const timeSummary = minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;

	return {
		shift: s.notes ?? "",
		date,
		timeSummary,
		start: startTime,
		end: endTime,
	};
}

/* The `formatPersonalShiftText` function takes a shift object as input and formats it into a text
representation. */
function formatPersonalShiftText(shift) {
	const f = formatPersonalShiftTemporal(shift);
	if (!f) return null;

	return [
		`Shift: ${f.shift}`,
		`Date: ${f.date}`,
		`TimeSummary: ${f.timeSummary}`,
		`Start: ${f.start}`,
		`End: ${f.end}`,
	].join("\n");
}

function formatPersonalShifts(shifts) {
	if (!Array.isArray(shifts)) return [];

	return shifts.map(formatPersonalShiftText).filter(Boolean);
}

function shiftMatchesPeriod(shift, { year, month }) {
	const s = shift.sharedShift ?? shift.draftShift;
	if (!s?.startDateTime) return false;

	const start = Temporal.Instant.from(s.startDateTime).toZonedDateTimeISO(TZ);

	if (year && start.year !== year) return false;
	if (month && start.month !== month) return false;

	return true;
}

function filterShiftsByPeriod(shifts, { year, month } = {}) {
	if (!Array.isArray(shifts)) return [];

	return shifts.filter((shift) => shiftMatchesPeriod(shift, { year, month }));
}

function currentMonthFilter() {
	const now = Temporal.Now.zonedDateTimeISO(TZ);
	return { year: now.year, month: now.month };
}

function sumFromFormattedStrings(formatted) {
	let totalMinutes = 0;

	for (const block of formatted) {
		// block contains e.g. "TimeSummary: 4h 30m"
		const match = String(block).match(/TimeSummary:\s*([^\n]+)/);
		if (!match) continue;

		const summary = match[1]; // "4h 30m" or "5h"
		const h = summary.match(/(\d+)\s*h/);
		const m = summary.match(/(\d+)\s*m/);

		if (h) totalMinutes += parseInt(h[1], 10) * 60;
		if (m) totalMinutes += parseInt(m[1], 10);
	}

	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function parseHoursToDecimal(timeString) {
	const h = timeString.match(/(\d+)\s*h/);
	const m = timeString.match(/(\d+)\s*m/);

	const hours = h ? parseInt(h[1], 10) : 0;
	const minutes = m ? parseInt(m[1], 10) : 0;

	return hours + minutes / 60;
}

async function main() {
	dotenv.config();
	const mau_id = process.env.MAU_ID;
	const pwd = process.env.MAU_PWD;
	const mfa_secret = process.env.MFA_SECRET;

	if (!mau_id || !pwd) throw new Error("Missing MAU_ID or MAU_PWD in .env");

	const debugOpts = parseDebugOptions();

	// CREATE LOGGER
	const log = createLogger(debugOpts);

	log.info("Debug options:", debugOpts);

	const BearerToken = await fetchJWT(mau_id, pwd, mfa_secret, debugOpts);
	log.info("Got bearer token");

	const UserID = await graphRequestUserID(BearerToken, log);
	log.verbose("userid:", UserID);

	const data = await graphRequestSchedule(BearerToken, log);

	const filteredData = filterPersonalShifts(data, UserID);
	log.trace("filteredData:", filteredData);

	const formattedData = formatPersonalShifts(filteredData);
	log.trace("formattedData:", formattedData);
	// Pretty print
	log.info(formattedData.join("\n\n"));

	const thisMonthFormattedData = filterShiftsByPeriod(
		filteredData,
		currentMonthFilter(),
	);
	const thisMonthFormattedShifts = formatPersonalShifts(thisMonthFormattedData);
	log.info(thisMonthFormattedShifts.join("\n\n"));

	console.log(thisMonthFormattedShifts.join("\n\n"));

	const totalHoursStr = sumFromFormattedStrings(thisMonthFormattedShifts);
	console.log(totalHoursStr);

	const totalHours = parseHoursToDecimal(totalHoursStr);

	const pretax = totalHours * 140;
	const pretax_sem = pretax * 1.12;
	const posttax = pretax_sem * 0.7;

	log.info("pre-tax:", pretax_sem.toFixed(0) + "kr");
	log.info("post-tax:", posttax.toFixed(0) + "kr");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
