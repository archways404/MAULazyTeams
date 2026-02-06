import { getBearerToken, getTokenStatus } from "../../functions/token.js";

export default async function healthGet(app) {
	app.get("/", async () => {
		const log = app.logx;
		const debugOpts = app.debugOpts;

		const status = getTokenStatus();

		// Try to ensure a token exists (non-blocking refresh attempt)
		try {
			await getBearerToken({ log, debugOpts });
		} catch (e) {
			return {
				ok: false,
				service: "up",
				auth: "failed",
				message: e?.message ?? String(e),
				tokenStatus: status,
			};
		}

		const updated = getTokenStatus();

		return {
			ok: true,
			service: "up",
			auth: updated.isValid ? "ok" : "stale",
			tokenStatus: {
				hasToken: updated.hasToken,
				isValid: updated.isValid,
				expiresAt: updated.expiresAt,
				expiresInSeconds: updated.expiresAt
					? Math.max(0, Math.floor((updated.expiresAt - Date.now()) / 1000))
					: null,
			},
		};
	});

	app.get("/ready", async () => ({ ok: app.isReady, ready: app.isReady }));
}
