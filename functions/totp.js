import { TOTP } from "totp-generator";

export async function generateTOTP(mfa_secret) {
	const TOTP_TOKEN = await TOTP.generate(mfa_secret);
	return TOTP_TOKEN.otp;
}
