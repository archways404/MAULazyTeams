import { Temporal } from "@js-temporal/polyfill";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
import { TOTP } from "totp-generator";

async function generateTOTP(mfa_secret) {
	const full_token = await TOTP.generate(mfa_secret);
	return full_token.otp;
}

async function fetchJWT(mau_id, pwd, mfa_secret) {
	const browser = await puppeteer.launch({
		headless: false,
		defaultViewport: null,
	});

	// Use existing tab
	const [page] = await browser.pages();

	await page.goto(
		"https://developer.microsoft.com/en-us/graph/graph-explorer",
		{
			waitUntil: "networkidle2",
		},
	);

	console.log("Main page loaded.");

	// Wait for sign in button
	await page.waitForSelector('button[aria-label="Sign in"]');

	console.log("Clicking Sign in...");

	// Prepare to capture the popup BEFORE clicking
	const popupPromise = new Promise((resolve) =>
		browser.once("targetcreated", async (target) => {
			const newPage = await target.page();
			resolve(newPage);
		}),
	);

	// Click the sign-in button
	await page.click('button[aria-label="Sign in"]');

	// Wait for the popup page to be available
	const popup = await popupPromise;

	console.log("Popup window detected!");

	// Wait until the popup is fully loaded
	await popup.waitForNavigation({ waitUntil: "domcontentloaded" });

	console.log("Now controlling login popup.");

	// Example: wait for email field
	await popup.waitForSelector('input[type="email"]', { timeout: 15000 });

	console.log("Login input detected.");

	// Wait for the email input to appear
	await popup.waitForSelector("#i0116", { timeout: 15000 });

	console.log("Email input found");

	// Type the email address
	await popup.type("#i0116", mau_id, { delay: 50 });

	await popup.waitForSelector("#idSIButton9", { timeout: 10000 });

	console.log("Clicking Next");

	await popup.click("#idSIButton9");

	// Wait for the password input to appear
	await popup.waitForSelector("#passwordInput", { timeout: 15000 });

	console.log("Password input found");

	// Type the email address
	await popup.type("#passwordInput", pwd, { delay: 50 });

	// Wait for the Sign in button to appear
	await popup.waitForSelector("#submitButton", { timeout: 10000 });

	console.log("Submit button found – clicking");

	// Click the button
	await popup.click("#submitButton");

	let errorVisible = false;

	try {
		await popup.waitForSelector("#idSpan_SAOTCS_Error_OTC", {
			visible: true,
			timeout: 6000,
		});
		errorVisible = true;
	} catch (e) {
		// selector never appeared → no error
	}

	if (errorVisible) {
		console.log("Error message appeared – doing fallback logic");
		// do something else
	} else {
		console.log("No error – continue normal flow");

		await popup.waitForSelector("#idRichContext_DisplaySign", {
			visible: true,
			timeout: 12000,
		});

		await popup.waitForSelector("#signInAnotherWay", { visible: true });
		console.log("found another way");
		await popup.evaluate(() => {
			document.querySelector("#signInAnotherWay")?.click();
		});
	}

	// PRESS THE USE CODE BUTTON

	const text = "Use a verification code";

	await popup.waitForFunction(
		(t) => {
			return [...document.querySelectorAll('[role="button"]')].some((el) =>
				el.innerText?.trim().includes(t),
			);
		},
		{},
		text,
	);

	await popup.evaluate((t) => {
		const button = [...document.querySelectorAll('[role="button"]')].find(
			(el) => el.innerText?.trim().includes(t),
		);

		button?.click();
	}, text);

	// INSERT CODE

	console.log("looking for code input");
	await popup.waitForFunction(() => {
		const el = document.querySelector('input[placeholder="Code"]');
		return el && !el.disabled;
	});

	console.log("found code input");

	const mfa_code = await generateTOTP(mfa_secret);

	console.log("MFA CODE:", mfa_code);

	console.log("writing code");
	await popup.type('input[placeholder="Code"]', mfa_code);
	console.log("code written!");

	//await page.click('input[type="submit"]');

	console.log("looking for verify button");
	await popup.evaluate(() => {
		const btn = [...document.querySelectorAll("input, button")].find(
			(el) => el.value === "Verify",
		);
		btn?.click();
	});
	console.log("verify button found and pressed!");

	/*
	const codeText = await popup.$eval(
		"#idRichContext_DisplaySign",
		(el) => el.textContent,
	);
	console.log("Displayed text:", codeText);
	*/

	// Wait until the popup is fully loaded
	await popup.waitForNavigation({ waitUntil: "domcontentloaded" });

	await popup.waitForFunction(
		() => {
			return document.body.innerText.includes("Stay signed in?");
		},
		{ timeout: 120000 },
	);

	console.log("Confirmed Stay signed in prompt");

	// Then click the button
	await popup.waitForSelector("#idSIButton9", { timeout: 30000 });
	await popup.click("#idSIButton9");

	// click idSIButton9 in popup...
	const popupClosed = new Promise((resolve) => popup.once("close", resolve));
	await Promise.race([
		popupClosed,
		popup
			.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
			.catch(() => {}),
	]);

	await page.bringToFront();
	await page
		.waitForNetworkIdle({ idleTime: 500, timeout: 60000 })
		.catch(() => {});

	await page.waitForFunction(
		() => {
			const text = "Access token";
			const candidates = [
				...document.querySelectorAll("div,button,span,a,[role]"),
			];
			return candidates.some((el) => (el.innerText || "").trim() === text);
		},
		{ timeout: 30000 },
	);

	await page.evaluate(() => {
		const text = "Access token";
		const candidates = [
			...document.querySelectorAll("div,button,span,a,[role]"),
		];

		// Prefer clickable things
		const el =
			candidates.find(
				(e) =>
					(e.innerText || "").trim() === text &&
					e.closest("button,a,[role='menuitem'],[role='option']"),
			) || candidates.find((e) => (e.innerText || "").trim() === text);

		const clickable =
			el?.closest("button,a,[role='menuitem'],[role='option']") || el;
		clickable?.click();
	});

	const jwtToken = await page.evaluate(() => {
		const el = document.querySelector('[tabindex="0"].fui-Text');
		return el ? el.textContent : null;
	});

	console.log(jwtToken);
	return jwtToken;
}

async function graphRequestUserID(accessToken) {
	const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=id", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	const text = await res.text();

	if (!res.ok) {
		throw new Error(`Graph error ${res.status}: ${text}`);
	}

	const resp = JSON.parse(text);
	return resp.id;
}

async function graphRequestSchedule(accessToken) {
	const res = await fetch(
		"https://graph.microsoft.com/v1.0/teams/85cbf237-9110-4755-9bc4-d7e16fdbb68a/schedule/shifts",
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		},
	);

	const text = await res.text();

	if (!res.ok) {
		throw new Error(`Graph error ${res.status}: ${text}`);
	}

	const data = JSON.parse(text);
	return data;
}

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
	const pwd = process.env.PWD;
	const mfa_secret = process.env.PWD;

	const BearerToken = await fetchJWT(mau_id, pwd, mfa_secret);
	//const BearerToken ="";

	const UserID = await graphRequestUserID(BearerToken);
	console.log("userid: ", UserID);

	const data = await graphRequestSchedule(BearerToken);

	const filteredData = filterPersonalShifts(data, UserID);
	console.log("filteredData:", filteredData);

	const formattedData = formatPersonalShifts(filteredData);
	console.log("formattedData:", formattedData);
	// Pretty print
	console.log(formattedData.join("\n\n"));

	const thisMonthFormattedData = filterShiftsByPeriod(
		filteredData,
		currentMonthFilter(),
	);
	const thisMonthFormattedShifts = formatPersonalShifts(thisMonthFormattedData);
	console.log("thisMonthFormattedShifts:", thisMonthFormattedShifts);

	console.log(thisMonthFormattedShifts.join("\n\n"));

	const totalHoursStr = sumFromFormattedStrings(thisMonthFormattedShifts);
	console.log(totalHoursStr);

	const totalHours = parseHoursToDecimal(totalHoursStr);

	const pretax = totalHours * 140;
	const pretax_sem = pretax * 1.12;
	const posttax = pretax_sem * 0.7;

	console.log("pre-tax:", pretax_sem.toFixed(0) + "kr");
	console.log("post-tax:", posttax.toFixed(0) + "kr");
}

main().catch(console.error);
