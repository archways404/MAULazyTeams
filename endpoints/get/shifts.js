import {
	graphRequestSchedule,
	graphRequestUserID,
} from "../../functions/fetch.js";
import { filterPersonalShifts } from "../../functions/filterdata.js";
import { getBearerToken } from "../../functions/token.js";

export default async function shiftsGet(app) {
	app.get("/me", async () => {
		const log = app.logx;
		const debugOpts = app.debugOpts;

		const token = await getBearerToken({ log, debugOpts });

		const userId = await graphRequestUserID(token, log);
		const data = await graphRequestSchedule(token, log);

		const filtered = filterPersonalShifts(data, userId);

		return { userId, count: filtered.length, shifts: filtered };
	});
}
