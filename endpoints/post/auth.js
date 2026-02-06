import { getBearerToken, invalidateTokenCache } from "../../functions/token.js";

export default async function authPost(app) {
	app.post("/refresh", async () => {
		const log = app.logx;
		const debugOpts = app.debugOpts;

		invalidateTokenCache();
		const token = await getBearerToken({ log, debugOpts });

		return { ok: true, cached: true, tokenPreview: token?.slice(0, 16) + "…" };
	});
}
