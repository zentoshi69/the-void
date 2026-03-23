import Fastify from "fastify";
import { loadEnv } from "@void/config";
import { registerCors } from "./plugins/cors.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWebSocket } from "./ws/index.js";

const env = loadEnv();

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" } }
        : undefined,
  },
});

await registerCors(app);
await registerErrorHandler(app);
await registerWebSocket(app);
await registerHealthRoutes(app);

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down gracefully`);
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info(`The Void API running on ${env.API_HOST}:${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
