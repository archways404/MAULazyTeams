import dotenv from "dotenv";

import { fetchJWT } from "./puppeteer.js";

dotenv.config();

const tokenCache = {
	token: null,
	expiresAtMs: 0,
};

export function invalidateTokenCache() {
	tokenCache.token = null;
	tokenCache.expiresAtMs = 0;
}

export function isTokenValid() {
	return tokenCache.token && Date.now() < tokenCache.expiresAtMs - 30_000;
}

// Pass a single options object to keep it clean
export async function getBearerToken({ log, debugOpts }) {
	if (isTokenValid()) {
		log?.verbose?.("Using cached bearer token");
		return tokenCache.token;
	}

	const mau_id = process.env.MAU_ID;
	const pwd = process.env.MAU_PWD;
	const mfa_secret = process.env.MFA_SECRET;

	if (!mau_id || !pwd) throw new Error("Missing MAU_ID or MAU_PWD in .env");

	log?.info?.("Refreshing bearer token...");

	const token = await fetchJWT(mau_id, pwd, mfa_secret, debugOpts, log);

	// Conservative TTL unless you decode exp properly
	tokenCache.token = token;
	const expMs = expiryFromJwt(token);
	tokenCache.expiresAtMs = expMs || Date.now() + 45 * 60 * 1000;

	return token;
}

function decodeJwtPayload(token) {
	const [, payloadB64] = String(token).split(".");
	if (!payloadB64) return null;

	const b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
	const pad = "=".repeat((4 - (b64.length % 4)) % 4);
	const json = Buffer.from(b64 + pad, "base64").toString("utf8");
	return JSON.parse(json);
}

function expiryFromJwt(token) {
	try {
		const payload = decodeJwtPayload(token);
		if (!payload?.exp) return 0;
		return payload.exp * 1000; // exp is seconds
	} catch {
		return 0;
	}
}

export function getTokenStatus() {
	return {
		hasToken: Boolean(tokenCache.token),
		expiresAt: tokenCache.expiresAtMs || null,
		isValid: isTokenValid(),
	};
}
