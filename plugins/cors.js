import cors from "@fastify/cors";

export default async function registerCors(app) {
	await app.register(cors, {
		origin: (origin, cb) => {
			// allow curl / same-origin requests (no Origin header)
			if (!origin) return cb(null, true);

			// allow extension origins + local dev
			if (
				origin.startsWith("moz-extension://") ||
				origin.startsWith("chrome-extension://") ||
				origin.startsWith("http://localhost") ||
				origin.startsWith("http://127.0.0.1")
			) {
				return cb(null, true);
			}

			// deny everything else by default
			return cb(new Error("Not allowed by CORS"), false);
		},
		credentials: true,
		methods: ["GET", "POST", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	});

	app.logx?.verbose?.("CORS registered");
}
