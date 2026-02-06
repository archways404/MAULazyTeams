// fetch.js

/**
 * Minimal helper so we can always call log.info(...) even if no logger was passed.
 */
function noopLogger() {
	return {
		error: () => {},
		info: () => {},
		verbose: () => {},
		trace: () => {},
	};
}

async function readTextSafe(res) {
	try {
		return await res.text();
	} catch {
		return "";
	}
}

function truncate(s, n = 400) {
	if (!s) return s;
	return s.length > n ? s.slice(0, n) + "…" : s;
}

export async function graphRequestUserID(accessToken, log = noopLogger()) {
	const url = "https://graph.microsoft.com/v1.0/me?$select=id";

	log.verbose("Graph GET:", url);

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	const text = await readTextSafe(res);

	if (!res.ok) {
		log.error("Graph error (me):", res.status, truncate(text));
		throw new Error(`Graph error ${res.status}: ${text}`);
	}

	const resp = JSON.parse(text);
	log.info("Graph user id fetched.");
	log.trace("Graph /me response:", resp);

	return resp.id;
}

export async function graphRequestExternalUserID(
	accessToken,
	MAU_EMAIL,
	log = noopLogger(),
) {
	const url = `https://graph.microsoft.com/v1.0/users/${MAU_EMAIL}`;

	log.verbose("Graph GET:", url);

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	const text = await readTextSafe(res);

	if (!res.ok) {
		log.error("Graph error (me):", res.status, truncate(text));
		throw new Error(`Graph error ${res.status}: ${text}`);
	}

	const resp = JSON.parse(text);
	log.info("Graph user id fetched.");
	log.trace("Graph MAU_EMAIL - ID response:", resp.id);

	return resp.id;
}

export async function graphRequestSchedule(accessToken, log = noopLogger()) {
	const url =
		"https://graph.microsoft.com/v1.0/teams/85cbf237-9110-4755-9bc4-d7e16fdbb68a/schedule/shifts";

	log.verbose("Graph GET:", url);

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	const text = await readTextSafe(res);

	if (!res.ok) {
		log.error("Graph error (schedule):", res.status, truncate(text));
		throw new Error(`Graph error ${res.status}: ${text}`);
	}

	const data = JSON.parse(text);
	log.info("Graph schedule fetched.");
	log.trace("Graph schedule response:", data);

	return data;
}
