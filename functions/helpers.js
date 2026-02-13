import dotenv from "dotenv";

dotenv.config();

export const DEBUG_MODES = Object.freeze({
	OFF: "off",
	ERROR: "error",
	INFO: "info",
	VERBOSE: "verbose",
	TRACE: "trace",
});

export const DEFAULT_DEBUG_OPTIONS = Object.freeze({
	mode: DEBUG_MODES.OFF,

	// “auto” means: decide based on mode
	headless: "auto", // "auto" | true | false

	slowMo: 0,
	devtools: false,

	logConsole: false,
	logRequests: false,
	screenshots: false,

	timeoutMs: 30000,
});

function defaultsForMode(mode) {
	switch (mode) {
		case DEBUG_MODES.ERROR:
			return { logConsole: true };
		case DEBUG_MODES.INFO:
			return { logConsole: true };
		case DEBUG_MODES.VERBOSE:
			return { logConsole: true, logRequests: true, slowMo: 25 };
		case DEBUG_MODES.TRACE:
			return {
				logConsole: true,
				logRequests: true,
				slowMo: 75,
				devtools: true,
				screenshots: true,
			};
		case DEBUG_MODES.OFF:
		default:
			return {};
	}
}

function envStr(value, fallback) {
	return value == null || value === "" ? fallback : String(value).trim();
}

function envBool(value, fallback) {
	if (value == null || value === "") return fallback;
	const v = String(value).trim().toLowerCase();
	if (["1", "true", "yes", "y", "on"].includes(v)) return true;
	if (["0", "false", "no", "n", "off"].includes(v)) return false;
	return fallback;
}

function envInt(value, fallback) {
	if (value == null || value === "") return fallback;
	const n = Number.parseInt(String(value), 10);
	return Number.isFinite(n) ? n : fallback;
}

// headless supports: auto / true / false / 1 / 0
function envHeadless(value, fallback = "auto") {
	if (value == null || value === "") return fallback;
	const v = String(value).trim().toLowerCase();
	if (v === "auto") return "auto";
	if (["1", "true", "yes", "on"].includes(v)) return true;
	if (["0", "false", "no", "off"].includes(v)) return false;
	return fallback;
}

export function debugOptionsFromEnv(env = process.env) {
	const modeRaw = envStr(env.DEBUG_MODE ?? env.DEBUG, "off").toLowerCase();

	// allow DEBUG=1 as shorthand => info
	const mode =
		modeRaw === "1" || modeRaw === "true"
			? "info"
			: Object.values(DEBUG_MODES).includes(modeRaw)
				? modeRaw
				: "off";

	return {
		mode,
		headless: envHeadless(env.DEBUG_HEADLESS, "auto"),
		slowMo: envInt(env.DEBUG_SLOWMO, DEFAULT_DEBUG_OPTIONS.slowMo),
		devtools: envBool(env.DEBUG_DEVTOOLS, DEFAULT_DEBUG_OPTIONS.devtools),
		timeoutMs: envInt(env.DEBUG_TIMEOUT_MS, DEFAULT_DEBUG_OPTIONS.timeoutMs),

		logConsole: envBool(
			env.DEBUG_LOG_CONSOLE,
			DEFAULT_DEBUG_OPTIONS.logConsole,
		),
		logRequests: envBool(
			env.DEBUG_LOG_REQUESTS,
			DEFAULT_DEBUG_OPTIONS.logRequests,
		),
		screenshots: envBool(
			env.DEBUG_SCREENSHOTS,
			DEFAULT_DEBUG_OPTIONS.screenshots,
		),
	};
}

export function parseDebugOptions(input, env = process.env) {
	const base = { ...DEFAULT_DEBUG_OPTIONS };
	const fromEnv = debugOptionsFromEnv(env);

	let fromInput = {};
	if (typeof input === "boolean") {
		fromInput = { mode: input ? DEBUG_MODES.INFO : DEBUG_MODES.OFF };
	} else if (input && typeof input === "object") {
		fromInput = { ...input };
	}

	const merged = { ...base, ...fromEnv, ...fromInput };

	// Apply implied defaults for the chosen mode *unless user/env explicitly set a flag*
	const implied = defaultsForMode(merged.mode);

	return {
		...merged,
		...Object.fromEntries(
			Object.entries(implied).filter(([k]) => merged[k] === base[k]),
		),
	};
}

export function resolvePuppeteerLaunchOptions(opts) {
	const debugOn = opts.mode !== DEBUG_MODES.OFF;

	// keep your behavior:
	// - debug on => headed by default
	// - debug off => headless by default
	const headless =
		typeof opts.headless === "boolean" ? opts.headless : debugOn ? false : true;

	const inDocker =
		process.env.IN_DOCKER === "true" ||
		process.env.DOCKER === "true" ||
		!!process.env.COOLIFY_CONTAINER_NAME ||
		!!process.env.KUBERNETES_SERVICE_HOST ||
		process.env.CI === "true";

	const dockerArgs = [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-gpu",
	];

	return {
		headless,
		defaultViewport: null,
		slowMo: debugOn ? (opts.slowMo ?? 0) : undefined,
		devtools: debugOn ? Boolean(opts.devtools) : false,

		// 👇 critical for containers
		args: inDocker ? dockerArgs : undefined,
		executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
	};
}
