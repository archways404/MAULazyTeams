import cors from "@fastify/cors";

export default async function registerCors(app) {
	await app.register(cors, {
		origin: '*', // or lock to specific origin(s)
		credentials: true,
	});

	app.logx?.verbose?.("CORS plugin registered");
}
