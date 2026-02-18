import {
	graphRequestExternalUserID,
	graphRequestSchedule,
} from "../../functions/fetch.js";
import { filterPersonalShifts } from "../../functions/filterdata.js";
import { getBearerToken } from "../../functions/token.js";

export default async function shiftsPost(app) {
	app.post(
		"/me",
		{
			schema: {
				body: {
					type: "object",
					additionalProperties: false,
					required: ["apiKey"],
					properties: {
					email: { type: "string" },
					apiKey: { type: "string", minLength: 1 }
					}
				}
			}
		},
		async (req, reply) => {
			const log = app.logx;
			const debugOpts = app.debugOpts;

			const apiKey = (req.body?.apiKey ?? "").trim();

			if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
				log.info("Invalid API key attempt");
				return reply.status(401).send({ ok: false, message: "Invalid API key" });
			}

			const token = await getBearerToken({ log, debugOpts });
			const data = await graphRequestSchedule(token, log);

			// If no email provided -> return unfiltered (but you can still prune deletions if you want)
			const email = (req.body?.email ?? "").trim();
			if (!email) {
				log.verbose(
					"POST /shifts/me with no email -> returning unfiltered schedule data",
				);
				return {
					filtered: false,
					count: Array.isArray(data?.value) ? data.value.length : 0,
					shifts: data?.value ?? [],
				};
			}

			// Email provided -> lookup user ID -> filter
			const userId = await graphRequestExternalUserID(token, email, log);

			const filtered = filterPersonalShifts(data, userId);

			log.info("POST /shifts/me filtered by user:", email);

			return {
				filtered: true,
				email,
				userId,
				count: filtered.length,
				shifts: filtered,
			};
		},
	);
}
