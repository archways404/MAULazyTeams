import healthGet from "./get/health.js";
import shiftsGet from "./get/shifts.js";
import authPost from "./post/auth.js";
import shiftsPost from "./post/shifts.js";

export default async function registerEndpoints(app) {
	await app.register(healthGet, { prefix: "/health" });
	await app.register(shiftsGet, { prefix: "/shifts" });
	await app.register(authPost, { prefix: "/auth" });
	await app.register(shiftsPost, { prefix: "/shifts" });
}
