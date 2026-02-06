import dotenv from "dotenv";
import Fastify from "fastify";
import registerEndpoints from "./endpoints/index.js";
import {
	graphRequestExternalUserID,
	graphRequestSchedule,
	graphRequestUserID,
} from "./functions/fetch.js";
import { filterPersonalShifts } from "./functions/filterdata.js";
import { parseDebugOptions } from "./functions/helpers.js";
import { createLogger } from "./functions/log.js";
import { getBearerToken, isTokenValid } from "./functions/token.js";
import registerCors from "./plugins/cors.js";

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

	const app = Fastify({
		logger: false, // you already have your own logger
	});

	// Attach shared objects so routes can use them
	app.decorate("logx", log);
	app.decorate("debugOpts", debugOpts);

	const port = Number(process.env.PORT ?? 3000);
	const host = process.env.HOST ?? "127.0.0.1";

	// IMPORTANT: don't call this "ready" (Fastify has app.ready())
	app.decorate("isReady", false);

	// Block requests until ready (except health endpoints)
	app.addHook("onRequest", async (req, reply) => {
		if (req.url.startsWith("/health")) return;

		if (!app.isReady) {
			return reply.code(503).send({
				ok: false,
				ready: false,
				reason: "starting_up",
			});
		}
	});

	await app.register(registerCors);
	await app.register(registerEndpoints);

	try {
		await getBearerToken({ log, debugOpts });
		log.info("Bearer token primed.");
		app.isReady = true;
	} catch (e) {
		log.error("Token prime failed at boot:", e?.message ?? e);
		// server still starts; app.isReady remains false -> 503 for non-health
	}

	await app.listen({ port, host });
	log.info(`Fastify listening on http://${host}:${port}`);

	/*
	const BearerToken = await fetchJWT(mau_id, pwd, mfa_secret, debugOpts);
	log.info("Got bearer token");

	const UserID = await graphRequestUserID(BearerToken, log);
	log.verbose("userid:", UserID);

	const data = await graphRequestSchedule(BearerToken, log);

	const MAU_EMAIL = process.env.MAU_EMAIL;
	const MAU_EMAIL_ID = await graphRequestExternalUserID(
		BearerToken,
		MAU_EMAIL,
		log,
	);
	log.info("MAU_EMAIL_ID: ", MAU_EMAIL_ID);

	const filteredData = filterPersonalShifts(data, UserID);
	log.trace("filteredData:", filteredData);
	*/
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
