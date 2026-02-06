import puppeteer from "puppeteer";
import { parseDebugOptions, resolvePuppeteerLaunchOptions } from "./helpers.js";
import { createLogger } from "./log.js";
import { generateTOTP } from "./totp.js";

export async function fetchJWT(
	mau_id,
	pwd,
	mfa_secret,
	debug = undefined,
	log = undefined,
) {
	const debugOpts = parseDebugOptions(debug); // input overrides env/defaults
	const logger = log ?? createLogger(debugOpts);
	const launchOpts = resolvePuppeteerLaunchOptions(debugOpts);

	logger.info("Launching puppeteer:", launchOpts);
	const browser = await puppeteer.launch(launchOpts);

	try {
		const page = await openGraphExplorer(browser, logger);
		const popup = await openSignInPopup(browser, page, logger);

		await enterEmail(popup, mau_id, logger);
		await enterPassword(popup, pwd, logger);
		await navigateToVerificationCodeOption(popup, logger);
		await enterMfaCode(popup, mfa_secret, logger);
		await confirmStaySignedIn(popup, logger);
		await waitForPopupClose(popup, logger);

		const token = await extractAccessToken(page, logger);
		logger.info("fetchJWT success.");
		return token;
	} catch (err) {
		logger.error("fetchJWT failed:", err?.message ?? err);
		throw err;
	} finally {
		// optionally close in non-debug mode
		//if (debugOpts.mode === "off") await browser.close();
		await browser.close();
	}
}

async function openGraphExplorer(browser, log) {
	const [page] = await browser.pages();

	log.verbose("Navigating to Graph Explorer...");
	await page.goto(
		"https://developer.microsoft.com/en-us/graph/graph-explorer",
		{
			waitUntil: "networkidle2",
		},
	);

	log.info("Main page loaded.");
	return page;
}

async function openSignInPopup(browser, page, log) {
	log.verbose("Waiting for Sign in button...");
	await page.waitForSelector('button[aria-label="Sign in"]', {
		timeout: 15000,
	});

	const popupPromise = new Promise((resolve) =>
		browser.once("targetcreated", async (target) =>
			resolve(await target.page()),
		),
	);

	log.info("Clicking Sign in...");
	await page.click('button[aria-label="Sign in"]');

	const popup = await popupPromise;
	log.info("Popup window detected.");

	await popup
		.waitForNavigation({ waitUntil: "domcontentloaded" })
		.catch(() => {});
	log.verbose("Login popup loaded.");

	return popup;
}

async function enterEmail(popup, email, log) {
	log.verbose("Waiting for email input...");
	await popup.waitForSelector("#i0116", { timeout: 15000 });

	await popup.type("#i0116", email, { delay: 50 });
	log.info("Email entered.");

	await popup.waitForSelector("#idSIButton9", { timeout: 10000 });
	await popup.click("#idSIButton9");
	log.verbose("Clicked Next.");
}

async function enterPassword(popup, password, log) {
	log.verbose("Waiting for password input...");
	await popup.waitForSelector("#passwordInput", { timeout: 15000 });

	await popup.type("#passwordInput", password, { delay: 50 });
	log.info("Password entered.");

	await popup.waitForSelector("#submitButton", { timeout: 10000 });
	await popup.click("#submitButton");
	log.verbose("Clicked Sign in.");
}

async function navigateToVerificationCodeOption(popup, log) {
	log.verbose("Checking for potential login error...");

	let errorVisible = false;

	try {
		await popup.waitForSelector("#idSpan_SAOTCS_Error_OTC", {
			visible: true,
			timeout: 6000,
		});
		errorVisible = true;
	} catch {
		// selector never appeared - no error
	}

	if (errorVisible) {
		log.error("Login error detected, attempting fallback.");
	} else {
		log.verbose("No immediate error detected, waiting for sign-in context...");

		await popup.waitForSelector("#idRichContext_DisplaySign", {
			visible: true,
			timeout: 12000,
		});

		log.verbose("Looking for 'Sign in another way' option...");

		await popup.waitForSelector("#signInAnotherWay", { visible: true });

		await popup.evaluate(() => {
			document.querySelector("#signInAnotherWay")?.click();
		});

		log.info("Clicked 'Sign in another way'.");
	}

	const label = "Use a verification code";

	log.verbose("Waiting for verification code option to appear...");

	await popup.waitForFunction(
		(t) => {
			return [...document.querySelectorAll('[role="button"]')].some((el) =>
				el.innerText?.trim().includes(t),
			);
		},
		{},
		label,
	);

	await popup.evaluate((t) => {
		const button = [...document.querySelectorAll('[role="button"]')].find(
			(el) => el.innerText?.trim().includes(t),
		);
		button?.click();
	}, label);

	log.info("Selected 'Use a verification code'.");
}

async function enterMfaCode(popup, mfa_secret, log) {
	log.verbose("Waiting for MFA code input field...");

	await popup.waitForFunction(() => {
		const el = document.querySelector('input[placeholder="Code"]');
		return el && !el.disabled;
	});

	log.verbose("Generating MFA code...");

	const mfa_code = await generateTOTP(mfa_secret);

	log.info("Generated MFA code.");

	log.trace("MFA code value:", mfa_code);

	await popup.type('input[placeholder="Code"]', mfa_code);

	log.verbose("Typed MFA code into input.");

	await popup.evaluate(() => {
		const btn = [...document.querySelectorAll("input, button")].find(
			(el) => el.value === "Verify",
		);
		if (!btn) throw new Error("Verify button not found");
		btn.click();
	});

	log.info("MFA code submitted.");
}

async function confirmStaySignedIn(popup, log) {
	log.verbose("Waiting for 'Stay signed in?' prompt...");
	await popup.waitForFunction(
		() => document.body.innerText.includes("Stay signed in?"),
		{ timeout: 120000 },
	);

	await popup.waitForSelector("#idSIButton9", { timeout: 30000 });
	await popup.click("#idSIButton9");
	log.info("Confirmed 'Stay signed in'.");
}

async function waitForPopupClose(popup, log) {
	log.verbose("Waiting for popup to close or settle...");
	const popupClosed = new Promise((resolve) => popup.once("close", resolve));
	await Promise.race([
		popupClosed,
		popup
			.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
			.catch(() => {}),
	]);
	log.verbose("Popup closed/settled.");
}

async function extractAccessToken(page, log) {
	log.verbose("Bringing main page to front...");
	await page.bringToFront();

	await page
		.waitForNetworkIdle({ idleTime: 500, timeout: 60000 })
		.catch(() => {});
	log.verbose("Waiting for Access token tab...");

	await page.waitForFunction(
		() => {
			const candidates = [
				...document.querySelectorAll("div,button,span,a,[role]"),
			];
			return candidates.some(
				(el) => (el.innerText || "").trim() === "Access token",
			);
		},
		{ timeout: 30000 },
	);

	await page.evaluate(() => {
		const candidates = [
			...document.querySelectorAll("div,button,span,a,[role]"),
		];
		const el =
			candidates.find(
				(e) =>
					(e.innerText || "").trim() === "Access token" &&
					e.closest("button,a,[role='menuitem'],[role='option']"),
			) ||
			candidates.find((e) => (e.innerText || "").trim() === "Access token");

		(el?.closest("button,a,[role='menuitem'],[role='option']") || el)?.click();
	});

	const token = await page.evaluate(() => {
		const el = document.querySelector('[tabindex="0"].fui-Text');
		return el ? el.textContent : null;
	});

	if (!token)
		throw new Error("Failed to extract access token from Graph Explorer");

	log.info("Access token extracted.");
	log.trace("Access token (raw):", token); // keep this at trace
	return token;
}
